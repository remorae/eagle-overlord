const Discord = require("discord.js");
const client = new Discord.Client({autoReconnect: true});
const infoFile = require("./package.json");
const settingsFile = require("./Settings/settings.json");
//const fs = require(`fs`);
const request = require(`request`);
const stripAnsi = require(`strip-ansi`);

const token = settingsFile.token;
const botCreatorID = settingsFile.botCreatorID;
const commandPrefix = settingsFile.commandPrefix;
const validClassPrefixes = settingsFile.validClassPrefixes;
const commands = settingsFile.commands;
const defaultRoles = settingsFile.defaultRoles;
const serverRoles = settingsFile.serverRoles;
const serverChannels = settingsFile.serverChannels;
const compileLangs = settingsFile.compileLangs;
const maxCompileResultLength = 1900;
const hungID = settingsFile.hungID;

function isValidPrefix(roleName) {
    let result = false;
    validClassPrefixes.forEach(prefix => {
        if (roleName.toUpperCase().startsWith(prefix)) {
            result = true;
        }
    });
    return result;
}

function addRole(channel, member, role, roleName, allowPings) {
    if (!member.roles.some(toFind => toFind.id === role.id)) {
        member.addRole(role).then(member => {
            if (allowPings) {
                channel.send(`Added role "${roleName}" to ${member.user}.`);
            }
        }).catch(err => {
            client.fetchUser(botCreatorID).then(user => user.send(`Problem adding ${roleName} to ${member.user}: ${err}`));
        });
    } else if (allowPings) {
        channel.send(`User ${member.user} already has role "${roleName}".`);
    }
}

function removeRole(channel, member, role, roleName, allowPings) {
    if (member.roles.some(toFind => toFind.id === role.id)) {
        member.removeRole(role).then(member => {
            if (allowPings) {
                channel.send(`Removed role "${roleName}" from ${member.user}.`);
            }
        }).catch(err => {
            client.fetchUser(botCreatorID).then(user => user.send(`Problem removing ${roleName} from ${member.user}: ${err}`));
        });
    } else if (allowPings) {
        channel.send(`User ${member.user} does not have role "${roleName}".`);
    }
}

function changeRolesForMember(member, message, args, adding, isForOther, checkPrefix, allowPings) {    
    if (message.guild == null) {
        message.channel.send(`Command requires a guild.`);
    }
    if (member == null) {
        message.channel.send(`Invalid guildMember.`);
        return;
    }
    if (args.length < 1) {
        message.channel.send(`You must enter a role.`);
        return;
    }
    for (let i = (isForOther) ? 1 : 0; i < args.length; ++i) {
        const roleName = args[i];
        if (roleName == null) {
            continue;
        }
        if (checkPrefix && !isValidPrefix(roleName)) {
            message.channel.send(`"${roleName}" does not have a valid prefix.`);
            continue;
        }

        const role = parseRole(message.guild, roleName);
        if (role == null) {
            message.channel.send(`"${roleName}" is not a valid role.`);
            continue;
        }

        function addOrRemove(channel, member, role, roleName, allowPings) {
            if (adding) {
                addRole(channel, member, role, roleName, allowPings);
            } else {
                removeRole(channel, member, role, roleName, allowPings);
            }
        }

        if (member instanceof Array) {
            member.forEach(guildMember => addOrRemove(message.channel, guildMember, role, roleName, allowPings));
        }
        else {
            addOrRemove(message.channel, member, role, roleName, allowPings);
        }
    }
}

function listCommands(message) {
    let commandList = ""; 
    let visibleCommands = [];
    if (message.guild != null) {
        var authorMember = message.guild.member(message.author);
    }

    for (let i = 0; i < commands.length; ++i) {
        if (commands[i].visible && !commands[i].requiresGuild) {
            visibleCommands.push(commands[i]);
        } else if (authorMember != null) {
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

function welcome(member) {
    const welcomeChannel = member.guild.channels.get(serverChannels.find(ch => { return (ch.name === `welcome`); }).id);
    const generalChannel = member.guild.channels.get(serverChannels.find(ch => { return (ch.name === `general`); }).id);
    generalChannel.send(`${member.user} has logged on!` +
                        `\nPlease take a look at ${welcomeChannel} before you get started.`);
    for (let i = 0; i < defaultRoles.length; ++i) {
        const role = parseRole(member.guild, defaultRoles[i]);
        member.addRole(role)
        .catch(err => client.fetchUser(botCreatorID).then(user => user.send(err)));
    }
}

function handleACM(message, args) {
    if (args.length < 1) {
        message.channel.send(`Missing parameter. Use \`!help acm\` for more info.`);
        return;
    }
    
    const member = message.guild.member(message.author);
    const role = message.guild.roles.get(serverRoles.find(role => { return role.name === `ACM Members`; }).id);
    switch (args[0].toLowerCase()) {
        case `info`:
            const acmGeneralChannel = message.guild.channels.get(serverChannels.find(channel => { return channel.name === `acm-general`; }).id);
            message.channel.send(`ACM stands for Association for Computing Machinery. See ${acmGeneralChannel} for more info.`);
            return;
        case `join`:
            if (role != null && member.roles.get(role.id) == null) {
                member.addRole(role);
                member.send(`Welcome to ACM!`);
            }
            break;
        case `leave`:
            if (role != null && member.roles.get(role.id) != null) {
                member.removeRole(role);
                member.send(`ACM will miss you.`);
            }
            break;
    }
}

function handleCSC(message, args) {
    if (args.length < 1) {
        message.channel.send(`Missing parameter. Use \`!help csc\` for more info.`);
        return;
    }
    
    const member = message.guild.member(message.author);
    const role = message.guild.roles.get(serverRoles.find(role => { return role.name === `CSC Members`; }).id);
    switch (args[0].toLowerCase()) {
        case `info`:
            const cscGeneralChannel = message.guild.channels.get(serverChannels.find(channel => { return channel.name === `csc-general`; }).id);
            message.channel.send(`CSC stands for Cyber Security Club. See ${cscGeneralChannel} for more info.`);
            return;
        case `join`:
            if (role != null && member.roles.get(role.id) == null) {
                member.addRole(role);
                member.send(`Welcome to the CSC!`);
            }
            break;
        case `leave`:
            if (role != null && member.roles.get(role.id) != null) {
                member.removeRole(role);
                member.send(`The CSC will miss you.`);
            }
            break;
    }
}

function getID(message, args) {
    if (args.length < 2) {
        message.channel.send(`Missing parameter(s). See \`!help getID\` for more info.`);
        return;
    }
    switch (args[0]) {
        case `user`: {
            const gm = parseUser(message, args[1]);
            if (gm == null)
                message.author.send(`User not found.`);
            else 
                message.author.send(`User ` + args[1] + `: ` + gm.id);
            break;
        }
        case `channel`: {
            let channel = parseChannel(message, args[1]);
            if (channel == null)
                message.author.send(`Channel not found.`);
            else 
                message.author.send(`Channel ` + args[1] + `: ` + channel.id);
            break;
        }
        case `role`: {
            const role = parseRole(message.guild, args[1]);
            if (role == null)
                message.author.send(`Role not found.`);
            else 
                message.author.send(`Role ` + args[1] + `: ` + role.id);
            break;
        }
    }
}

function giveCaseWarning(message, commandSymbol) {
    message.reply(`did you mean "${commandSymbol}"? Commands are cASe-SeNsiTIvE.`);
}

function displayHelpMessage(message, args) {
    if (args.length === 0) {
        const helpChannel = (message.guild != null) ? message.guild.channels.get(serverChannels.find(channel => { return (channel.name === "help"); }).id) : null;
        message.channel.send(`If you'd like help with specific command syntax, please use \`!help <commandName>\`.` +
                                    `\nIf you'd like to see available commands, please use \`!commands\`.` +
                                    ((helpChannel != null) ? `\nIf you need help with Discord or something not specific to a class, please ask a question in ${helpChannel}.` : ``));
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
    if (matches != null) {
        logMessage(message);
        let url = matches[0].trim().toLowerCase();
        message.channel.send(`<http://www.reddit.com` + url + `>`);
    }
}

function parseUser(message, arg) {
    if (message.guild == null) {
        message.channel.send(`This command requires a guild.`);
        return null;
    }
    if (arg == null) {
        message.channel.send(`You must enter a user.`);
        return null;
    }
    if (arg === `all`) {
        return message.guild.members.array();
    }
    let gm = message.guild.members.find(member => { return member.user.id === arg; });
    if (gm == null) {
        gm = message.guild.members.find(member => { return (member.user.username === arg); });
    }
    if (gm == null && arg.length > 2
        && arg[0] == arg[arg.length - 1]
        && (arg[0] === `"` || arg[0] === `'` || arg[0] === '`')) {
        const memberName = arg.substr(1, arg.length - 2); // Assume quotes around name
        gm = message.guild.members.find(member => member.displayName === memberName);
    }
    return gm;
}

function parseRole(guild, arg) {
    let role = guild.roles.find(role => { return role.id === arg; });
    if (role == null) {
        role = guild.roles.find(role => { return role.name === arg; });
    }
    if (role == null && arg.length > 2
        && arg[0] === arg[arg.length - 1]
        && (arg[0] === `"` || arg[0] === `'` || arg[0] === '`')) {
        role = guild.roles.find(role => { return role.name === arg.substr(1, arg.length - 2); });
    }
    return role;
}

function parseChannel(message, arg) {
    console.log(arg);
    let ch = message.guild.channels.find(channel => channel.id === arg);
    if (ch == null) {
        ch = message.guild.channels.find(channel => channel.name === arg);
    }
    if (ch == null && arg.length > 2
        && arg[0] === arg[arg.length - 1]
        && (arg[0] === `"` || arg[0] === `'` || arg[0] === '`')) {
        ch = message.guild.channels.find(channel => { return channel.name === arg.substr(1, arg.length - 2); });
    }
    return ch;
}

function compile(source, language, cb) {
	request.post({
		url: "https://api.jdoodle.com/v1/execute",
		json: {
			script: source,
            language: language.id,
            versionIndex: language.index,
			clientId: settingsFile.jdoodleID,
			clientSecret: settingsFile.jdoodleSecret
        },
        headers: {
            "content-type": "application/json"
        }
	}, function(err, response, body) {
        if (err) throw err;
		cb({
            error: body.error,
			output: body.output,
			statusCode: body.statusCode,
			cpuTime: body.cpuTime,
            memory: body.memory
		});
	})
}

function doCompileCommand(message, args) {
    if (args.length === 0) {
        message.channel.send(`Missing argument. See \`!help compile\` for more info.`);
        return;
    }
    if (args[0] === `langs`) {
        let msg = `Available languages:\n`;
        for (const lang in compileLangs) {
            msg += `${compileLangs[lang].full}: ${compileLangs[lang].id}\n`;
        }
        message.author.send(msg);
        return;
    }
    let language = compileLangs.find(item => item.id === args[0]);
    if (language == null) {
        message.channel.send(`Invalid language. Use \`!compile langs\` to receive a PM with available languages.`);
        return;
    }
    let source = /```(\w+\n)?([\s\S]+)```/m.exec(args[1]);
    if (source == null) {
        message.channel.send(`\Malformatted code. See \`!help compile\` for more info.`);
        return;
    }

    message.channel.send(`Compiling ${language.full}...`);
    compile(source[2].replace(/```/g, ""), language, function(results) {
        if (results.error != null) {
            reportError(`Error: ${results.error}\nStatusCode: ${results.statusCode}`);
            message.channel.send(`<@${botCreatorID}> messed up, go poke him!`);
        } else if (results.output) {
            message.channel.send(`Results for <@${message.author.id}>: \`\`\`${results.output.escape()}\`\`\``
            + `\nMemory: ${results.memory}, CPU Time: ${results.cpuTime}`);
        } else {
            client.fetchUser(botCreatorID)
            .then(user => user.send(`Bad compile:\n${message.content}`));
        }
    });
}

function processAddRole(message, args) {
    if (args.length != 1) {
        message.channel.send(`Invalid number of arguments.`);
    }

    const member = message.guild.member(message.author);
    let role = null;
    switch (args[0]) {
        case "csc-pnnl":
            role = parseRole(member.guild, "CSCCompetition");
            break;
        default:
            break;
    }
    if (role) {
        addRole(message.channel, member, role, role.name, true);
    }
    else {
        message.channel.send(`Invalid role.`);
    }
}

function reportError(message) {
    client.fetchUser(botCreatorID).then(user => {
        user.send(message);
    }).catch(err => {
        console.log(message);
    });
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
    client.user.setActivity(`with its food`);
});

client.on("messageUpdate", (oldMessage, newMessage) => {
    process(newMessage);
});

client.on("message", process);

function process(message) {
    try {
        if (message.author.bot) {
            return;
        }
        if (!message.content.startsWith(commandPrefix)) {
            handleNonCommand(message);
            return;
        }

        let args = message.content.trim().match(/[\w-_]+|"(?:\\"|[^"])+"|```(\w+\n)?([\s\S]+)```/gm);
        const messageCommandText = args.shift();
        const givenCommand = commands.find(com => { return (com.symbol === messageCommandText); });
        const requiresGuild = (givenCommand != null) ? givenCommand.requiresGuild : false;
        const authorMember = (message.guild != null) ? message.guild.member(message.author) : null;

        if (requiresGuild && authorMember == null) {
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

        if (givenCommand == null) {
            // No valid command was found; check if the message didn't match casing
            commands.forEach(com => {
                if (messageCommandText.toLowerCase() === `${com.symbol}`.toLowerCase()) {
                    giveCaseWarning(message, com.symbol);
                }
            });
            return;
        }

        switch (givenCommand.name) {
            case `helpCommand`:
                displayHelpMessage(message, args);
                break;
            case `aboutCommand`:
                message.channel.send(`Currently running on version ${infoFile.version}. Created in 2018 by Natrastellar.`);
                break;
            case `listCommandsCommand`:
                listCommands(message);
                break;
            case `addClassCommand`:
            case `removeClassCommand`:
            {
                if (message.guild == null) {
                    message.reply("No guild to change roles. Please note that this command does not work in private messages.");
                    return;
                }
                const member = message.guild.member(message.author);
                const adding = (givenCommand.name === `addClassCommand`);
                changeRolesForMember(member, message, args, adding, false, true, true);
                break;
            }
            case `addRoleToOtherCommand`:
            case `removeRoleFromOtherCommand`:
            {
                if (args.length < 1) {
                    message.channel.send(`Missing argument(s).`);
                }
                const member = parseUser(message, args[0]);
                const adding = (givenCommand.name === `addRoleToOtherCommand`);
                changeRolesForMember(member, message, args, adding, true, false, !(member instanceof Array));
                break;
            }
            case `testWelcomeCommand`:
            {
                if (args.length < 1) {
                    message.channel.send(`Missing argument(s).`);
                }
                const member = parseUser(message, args[0]);
                welcome(member);
                break;
            }
            case `acmCommand`:
                handleACM(message, args);
                break;
            case `getIDCommand`:
                getID(message, args);
                break;
            case `shrugCommand`:
                message.channel.send(`¯\\\_(ツ)\_/¯`);
                break;
            case `sayCommand`:
            {
                if (args.length === 0) {
                    message.channel.send(`Missing message. See \`!help say\` for more info.`)
                    return;
                }
                const msg = args[0].replace(/\"/g, "");
                let channel = message.channel;
                if (args.length > 1) {
                    if (message.guild == null) {
                        message.channel.send(`Sending a message to another channel requires a guild.`)
                        return;
                    }
                    channel = message.guild.channels.get(args[1]);
                }
                if (channel && msg) {
                    channel.send(msg);
                }
                break;
            }
            case `hungCommand`:
                if (message.author.id === hungID) {
                    message.author.send(`Hello there.`);
                }
                else {
                    message.channel.send(`No.`);
                }
                break;
            case `compileCommand`:
                doCompileCommand(message, args);
                break;
            case `cscCommand`:
                handleCSC(message, args);
                break;
            case `grantRoleCommand`:
                processAddRole(message, args);
                break;
            default:
                throw(`Bad command name.`);
        }
    } catch (err) {
        reportError(`Error on message event:\n` + err.message + ` ` + err.fileName + ` ` + err.lineNumber);
    }
}

client.on("guildMemberAdd", member => {
    try {
        welcome(member);
    } catch (err) {
        console.log(`Error on guildMemberAdd event:\n` + err.message + ` ` + err.fileName + ` ` + err.lineNumber);
    }
});

client.on("error", reportError);

function login() {
    try {
        client.login(token);
    }
    catch (err) {
        console.log(err);
        login();
    }
}

login();