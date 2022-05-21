const Discord = require("discord.js");
const client = new Discord.Client({autoReconnect: true});
const infoFile = require("./package.json");
const settingsFile = require("./Settings/settings.json");
const fs = require(`fs`);
const request = require(`request`);
const stripAnsi = require(`strip-ansi`);

const token = settingsFile.token;
const botID = settingsFile.botID;
const botCreatorID = settingsFile.botCreatorID;
const commandPrefix = settingsFile.commandPrefix;
const validClassPrefixes = settingsFile.validClassPrefixes;
const commands = settingsFile.commands;
const defaultRoles = settingsFile.defaultRoles;
const serverRoles = settingsFile.serverRoles;
const serverChannels = settingsFile.serverChannels;
const compileLangs = settingsFile.compileLangs;
const maxCompileResultLength = 1930;

function changeClassForMember(member, message, args, adding, isForOther) { 
    if (message.guild === null || message.guild.channels.get(message.channel.id).name === `general`) {
        return;
    }
    if (member === null) {
        message.channel.send(`Invalid guildMember.`);
    } else if (args.length < 1) {
        message.channel.send(`You must enter a class.`);
    } else {
        let changingForOther = (member.user.id !== message.author.id);
        for (let i = (isForOther) ? 1 : 0; i < args.length; ++i) {
            if (args[i] === "" || args[i] === " ") {
                continue;
            }
            let classToChange = args[i];
            if (classToChange !== null) {
                let isValidClass = false;
                // Ensure the class to change starts with a valid prefix (e.g. "CSCD") and is in the accepted prefix list.
                validClassPrefixes.forEach(prefix => {
                    if (classToChange.toUpperCase().startsWith(prefix)) {
                        isValidClass = true;
                    }
                });
    
                if (!isValidClass) {
                    message.channel.send(`"${classToChange}" is not a valid class.`);
                } else {
                    // The class is valid; ensure the role is valid before adding/removing it to/from the user.
                    let role = message.guild.roles.find(`name`, classToChange.toUpperCase());
                    if (role !== null) {
                        if (adding) {
                            // Attempt to add the class role.
                            if (member.roles.get(role.id) === null) {
                                member.addRole(role).then(member => {
                                    message.channel.send(`Added ${member.user} to class "${classToChange}".`);
                                    console.log(`Added ${member.user} to class "${classToChange}".`);
                                }).catch(member => {
                                    message.channel.send("An error occurred. I probably don't have permissions to assign roles :'(");
                                });
                            } else {
                                message.channel.send(`User ${member.user} is already in class "${classToChange}".`);
                            }
                        } else {
                            // Attempt to remove the class role.
                            if (member.roles.get(role.id) !== null) {
                                member.removeRole(role).then(member => {
                                    message.channel.send(`Removed ${member.user} from class "${classToChange}".`);
                                    console.log(`Removed ${member.user} from class "${classToChange}".`);
                                }).catch(member => {
                                    message.channel.send("An error occurred. I probably don't have permissions to remove roles :'(");
                                });
                            } else {
                                message.channel.send(`User ${member.user} is not in class "${classToChange}".`);
                            }
                        }
                    } else {
                        message.channel.send(`"${classToChange}" is not a valid class or does not have a role created on the server.`);
                    }
                }
            }
        }
    }
}

function listCommands(message) {
    let commandList = ""; 
    let visibleCommands = [];
    if (message.guild !== null) {
        var authorMember = message.guild.member(message.author);
    }

    for (let i = 0; i < commands.length; ++i) {
        if (commands[i].visible && !commands[i].requiresGuild) {
            visibleCommands.push(commands[i]);
        } else if (authorMember !== null) {
            let hasNeededPermissions = true;
            commands[i].permissions.forEach(perm => { 
                if (!authorMember.hasPermission(perm)) {
                    hasNeededPermissions = false;
                }
            });
            if (hasNeededPermissions) {
                visibleCommands.push(commands[i]);
            }
        }
    }

    for (let i = 0; i < visibleCommands.length; ++i) {
        commandList += visibleCommands[i].symbol + ((i < visibleCommands.length - 1) ? ", " : "");
    }
    message.channel.send(`Current commands: ${commandList}`);
}

function giveCaseWarning(message, commandSymbol) {
    message.reply(`did you mean "${commandSymbol}"? Commands are case-sensitive.`);
}

function displayHelpMessage(message, args, botCreatorUser) {
    if (args.length === 0) {
        let helpChannel = (message.guild !== null) ? message.guild.channels.get(serverChannels.find(channel => { return (channel.name === "help"); }).id) : null;
        message.channel.send(`If you'd like help with specific command syntax, please use "!help <commandName>".` +
                                    `\nIf you'd like to see available commands, please use "!commands".` +
                                    ((helpChannel !== null) ? `\nIf you need help with Discord or something not specific to a class, please ask a question in ${helpChannel}.` : ``));
    } else {
        let commandArg = args[0];
        var isValidCommand = false;
        commands.forEach(command => {
            if (commandArg.toLowerCase() === `${command.symbol}`.toLowerCase()) {
                isValidCommand = true;
                if (commandArg === command.symbol) {
                    message.channel.send(`Usage: ` + command.usage + "\nInfo: " + command.info);
                } else {
                    giveCaseWarning(message, command.symbol);
                }
            }
        });
        
        if (!isValidCommand) {
            message.channel.send(`Unrecognized command. See !help for more information or !commands for a list of valid commands.`);
        }
    }
}

function logMessage(message) {
    console.log(`[${message.createdAt}] ${message.author} (${message.author.username}): ${message.content}`);
}

function handleNonCommand(message) {
    var matches = message.content.match(/(^|[^\w]+)\/r\/\w+/i);
    if (matches !== null) {
        logMessage(message);
        let url = matches[0].trim().toLowerCase();
        message.channel.send(`<http://www.reddit.com` + url + `>`);
        console.log(`Attempting to link subreddit <http://www.reddit.com` + url + `>`);
    }
}

function getUserFromArgs(message, args) {
    if (message.guild === null) {
        message.reply(`No guild found. Please note that this command does not work in private messages.`);
        return;
    }
    if (args.length < 1) {
        message.channel.send(`You must enter a user.`);
        return;
    }
    let memberName = args[0];
    memberName = memberName.substr(1, memberName.length - 2);
    let gm = message.guild.members.find(`displayName`, memberName);
    if (gm === null)
        gm = message.guild.members.find(member => { return (member.user.username === args[0]); });
    return gm;
}

function compile(source, language, cb) {
	request.post({
		url: "https://api.jdoodle.com/v1/execute",
		form: {
			script: source,
            language: language.id,
            versionIndex: language.index,
			clientId: settingsFile.jdoodleID,
			clientSecret: settingsFile.jdoodleSecret
		}
	}, function(err, response, body) {
		if (err) throw err;
		const data = JSON.parse(body);
		cb({
			output: data.result.output,
			statusCode: data.result.statusCode,
			cpuTime: data.result.cpuTime,
			memory: data.result.memory
		});
	})
}

String.prototype.escape = function() {
	let str = stripAnsi(this).replace(/[^\x00-\x7F]/g, "").replace(/```/g, "\\`\\`\\`");
	if (str.length > maxCompileResultLength) {
		str = str.substr(0, maxCompileResultLength);
		str += "\n(...)";
	}
	return str;
}

client.on(`ready`, () => {
    console.log(`Boot sequence complete.`);
    client.user.setActivity(`Banhammer 40k`);
});

client.on("message", message => {
    try {
        if (message.author.bot) {
            return;
        }
        if (!message.content.startsWith(commandPrefix)) {
            handleNonCommand(message);
            return;
        }

        // logMessage(message);

        let args = message.content.trim().match(/\w+|"(?:\\"|[^"])+"|```(\w+\n)?([\s\S]+)```/gm);
        let messageCommandText = args.shift();
        let givenCommand = commands.find(com => { return (com.symbol === messageCommandText); });
        let requiresGuild = (givenCommand !== null) ? givenCommand.requiresGuild : false;
        let authorMember = (message.guild !== null) ? message.guild.member(message.author) : null;

        if (requiresGuild && authorMember === null) {
            message.reply(`the given command requires a guild, but no matching guildMember was found. Please make sure you aren't using this command in a private message.`);
            return;
        } else if (requiresGuild) {
            let hasNeededPermissions = true;
            givenCommand.permissions.forEach(perm => { if (!authorMember.hasPermission(perm)) { hasNeededPermissions = false; }  });
            if (!hasNeededPermissions) {
                message.reply(`you do not have permission to use this command.`);
                return;
            }
        }
        
        let botCreatorMember = null, botCreatorUser = null;
        if (message.guild === null || (botCreatorMember = message.guild.members.get(botCreatorID)) === null) {
            botCreatorUser = "Natrastellar";
        } else {
            botCreatorUser = botCreatorMember.user;
        }

        if (givenCommand === null) {
            // No valid command was found; check if the message didn't match casing
            commands.forEach(com => {
                if (messageCommandText.toLowerCase() === `${com.symbol}`.toLowerCase()) {
                    giveCaseWarning(message, com.symbol);
                }
            });
        } else {
            if (givenCommand.symbol === `help`) {
                displayHelpMessage(message, args, botCreatorUser);
            }

            else if (givenCommand.symbol === `about`) {
                message.channel.send(`Currently running on version ${infoFile.version}. Created in 2017 by Natrastellar.`);
            }

            else if (givenCommand.symbol === `commands`) {
                listCommands(message);
            }

            else if (givenCommand.symbol === `addClass` || givenCommand.symbol === `removeClass`) {
                if (message.guild === null) {
                    message.reply("No guild to change roles. Please note that this command does not work in private messages.");
                    return;
                }
                let member = message.guild.member(message.author);
                let adding = (givenCommand.symbol === `addClass`);
                changeClassForMember(member, message, args, adding, false);
            }

            else if (givenCommand.symbol === `addClassTo` || givenCommand.symbol === `removeClassFrom`) {
                let member = getUserFromArgs(message, args);
                let adding = (givenCommand.symbol === `addClassTo`);
                changeClassForMember(member, message, args, adding, true);
            }

            else if (givenCommand.symbol === `welcome`) {
                let member = getUserFromArgs(message, args);
                let moderatorRole = message.guild.roles.find(role => role.name.toLowerCase() === `moderators`);
                let helpChannel = serverChannels.find(ch => { return (ch.name === `help`); });
                message.channel.send(`Please welcome ${member.user} to the server!` +
                                            `\n${member.user.username}, please read through the rules.` + 
                                            `\nIf you have any questions, please feel free to mention ${moderatorRole} in ${message.guild.channels.get(helpChannel.id)} and we can assist you.`);
            }
            else if (givenCommand.symbol === `acm`) {
                if (message.guild === null) {
                    message.channel.send(`No guild available. Please note that this command does not work in private messages.`);
                    return;
                }
                if (args.length < 1) {
                    message.channel.send(`Missing parameter. Use \`!help acm\` for more info.`);
                    return;
                }
                
                let member = message.guild.member(message.author);
                let role = message.guild.roles.get(serverRoles.find(role => { return role.name === `ACM Members`; }).id);
                switch (args[0].toLowerCase()) {
                    case `info`:
                        message.channel.send(`ACM stands for Association for Computing Machinery. See ${message.guild.channels.get(`360933694443094016`)} for more info.`);
                        return;
                    case `join`:
                        if (role !== null && member.roles.get(role.id) === null) {
                            member.addRole(role);
                            member.send(`Welcome to ACM!`);
                        }
                        break;
                    case `leave`:
                        if (role !== null && member.roles.get(role.id) !== null) {
                            member.removeRole(role);
                            member.send(`ACM will miss you.`);
                        }
                        break;
                }
            }
            else if (givenCommand.symbol === `getID`) {
                if (message.guild === null) {
                    message.channel.send(`No guild available. Please note that this command does not work in private messages.`);
                    return;
                }
                if (args.length < 2) {
                    message.channel.send(`Missing parameter(s). See "!help getID" for more info.`);
                    return;
                }
                if (args[1][0] === '\"')
                    args[1] = args[1].substr(1, args[1].length - 2);
                switch (args[0]) {
                    case `user`: {
                        let gm = message.guild.members.find(`displayName`, args[1]);
                        if (gm === null) {
                            gm = message.guild.members.find(member => { return (member.user.username === args[1]); });
                        }
                        if (gm === null)
                            message.author.send(`User not found.`);
                        else 
                            message.author.send(`User \"` + args[1] + `\": ` + gm.id);
                        break;
                    }
                    case `channel`: {
                        let channel = message.guild.channels.find(`name`, args[1]);
                        if (channel === null)
                            message.author.send(`Channel not found.`);
                        else 
                            message.author.send(`Channel \"` + args[1] + `\": ` + channel.id);
                        break;
                    }
                    case `role`: {
                        let role = message.guild.roles.find(`name`, args[1]);
                        if (role === null)
                            message.author.send(`Role not found.`);
                        else 
                            message.author.send(`Role \"` + args[1] + `\": ` + role.id);
                        break;
                    }
                }
            }
            else if (givenCommand.symbol === `shrug`) {
                let channel = message.channel;
                //message.delete();
                channel.send(`¯\\\_(ツ)\_/¯`);
            }
            else if (givenCommand.symbol === `say`) {
                if (args.length === 0) {
                    message.channel.send(`Missing message. See "!help say" for more info.`)
                    return;
                }
                let msg = args[0].replace(/\"/g, "");
                let channel = message.channel;
                if (args.length > 1) {
                    if (message.guild === null) {
                        channel.send(`Sending a message to another channel requires a guild.`)
                        return;
                    }
                    channel = message.guild.channels.get(args[1]);
                }
                channel.send(msg);
            }
            else if (givenCommand.symbol === `compile`) {
                if (args.length === 0) {
                    message.channel.send(`Missing argument. See "!help compile" for more info.`);
                    return;
                }
                if (args[0] === `langs`) {
                    let msg = `Available languages:\n`;
                    for (const lang in compileLangs)
                        msg += `${lang.full}: ${lang.id}\n`;
                    message.author.send(msg);
                    return;
                }
                let language = compileLangs[args[0]];
                if (language === null) {
                    message.channel.send(`Invalid language. Use "!compile langs" to receive a PM with available languages.`);
                    return;
                }
                let source = /```(\w+\n)?([\s\S]+)```/m.exec(args[1]);
                if (source === null) {
                    message.channel.send(`\Malformatted code.`);
                    return;
                }

                message.channel.send(`Compiling ${language.full}...`);
                compile(source[1].replace(/```/g, ""), language, results => {
                    message.channel.send(`Results: \`\`\`${results.output.escape()}\`\`\``
                    + `\nMemory: ${results.memory}, CPU Time: ${results.cpuTime}`);
                });
            }
        }
    } catch (err) {
        client.fetchUser(botCreatorID).then(user => {
            user.send(`Error on message event:\n` + err.message + ` ` + err.fileName + ` ` + err.lineNumber);
        }).catch(err => {
            console.log(`Error on message event:\n` + err.message + ` ` + err.fileName + ` ` + err.lineNumber);
        });
    }
});

client.on("guildMemberAdd", member => {
    let guild = member.guild;
    try {
        let welcomeChannel = guild.channels.get(serverChannels.find(ch => { return (ch.name === `welcome`); }).id);
        let helpChannel = guild.channels.get(serverChannels.find(ch => { return (ch.name === `help`); }).id);
        let moderatorRole = guild.roles.get(serverRoles.find(role => { return (role.name === `moderators`); }).id);
        let generalChannel = guild.channels.get(serverChannels.find(ch => { return (ch.name === `general`); }).id);
        generalChannel.send(`Please welcome ${member.user} to the server!` +
                                                           `\n${member.user.username}, please read through the rules` + ((welcomeChannel !== null) ? ` in ${welcomeChannel}.` : `.`) + 
                                                           `\nIf you have any questions, please feel free to mention ${moderatorRole} in ${helpChannel} and we can assist you.`);
        for (let i = 0; i < defaultRoles.length; ++i) {
            member.addRole(defaultRoles[i]);
            console.log("Added default role " + guild.roles.get(defaultRoles[i]) + ` to ` + member.user);
        }
    } catch (err) {
        console.log(`Error on guildMemberAdd event:\n` + err.message + ` ` + err.fileName + ` ` + err.lineNumber);
    }
});

client.login(token);