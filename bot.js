const Discord = require("discord.js");
const client = new Discord.Client();
const info = require("./package.json");
const settings = require("./settings.json");

const token = settings.token;
const botCreatorID = settings.botCreatorID;
const commandPrefix = settings.commandPrefix;
const validClassPrefixes = settings.validClassPrefixes;
const commands = settings.commands;

var changeClassForMember = function (member, message, args, adding) {
    if (member == null) {
        message.channel.sendMessage("Invalid guildMember.");
    } else if (args.length < 1) {
        message.channel.sendMessage("You must enter a class.");
    } else {
        let changingForOther = (member.user.id != message.author.id);
        for (let i = 0; i < args.length; ++i) {
            if (args[i] === "" || args[i] === " ") {
                continue;
            }
            let classToChange = args[i];
            if (classToChange != null) {
                let isValidClass = false;
                // Ensure the class to change starts with a valid prefix (e.g. "CSCD") and is in the accepted prefix list.
                validClassPrefixes.forEach(prefix => {
                    if (classToChange.toUpperCase().startsWith(prefix)) {
                        isValidClass = true;
                    }
                });
    
                if (!isValidClass) {
                    message.channel.sendMessage(`"${classToChange}" is not a valid class.`);
                } else {
                    // The class is valid; ensure the role is valid before adding/removing it to/from the user.
                    let role = message.guild.roles.find("name", classToChange.toUpperCase());
                    if (role != null) {
                        if (adding) {
                            // Attempt to add the class role.
                            if (member.roles.get(role.id) == null) {
                                member.addRole(role).then(member => {
                                    message.channel.sendMessage(`Added ${member.user} to class "${classToChange}".`);
                                    console.log(`Added ${member.user} to class "${classToChange}".`);
                                }).catch(member => {
                                    message.channel.sendMessage("An error occurred. I probably don't have permissions to assign roles :'(");
                                });
                            } else {
                                message.channel.sendMessage(`User ${member.user} is already in class "${classToChange}".`);
                            }
                        } else {
                            // Attempt to remove the class role.
                            if (member.roles.get(role.id) != null) {
                                member.removeRole(role).then(member => {
                                    message.channel.sendMessage(`Removed ${member.user} from class "${classToChange}".`);
                                    console.log(`Removed ${member.user} from class "${classToChange}".`);
                                }).catch(member => {
                                    message.channel.sendMessage("An error occurred. I probably don't have permissions to remove roles :'(");
                                });
                            } else {
                                if (!changingForOther && settings.alwaysVisibleClasses.find(vclass => { return vclass.toUpperCase() === classToChange.toUpperCase(); }) != null) {
                                    message.reply(`you are not in the class "${classToChange}". Please note that the channel for ${classToChange} is visible to everyone.`);
                                } else {
                                    message.channel.sendMessage(`User ${member.user} is not in class "${classToChange}".`);
                                }
                            }
                        }
                    } else {
                        message.channel.sendMessage(`"${classToChange}" is not a valid class or does not have a role created on the server.`);
                    }
                }
            }
        }
    }
}

var listCommands = function (message) {
    let commandList = ""; 
    for (let i = 0; i < commands.length; ++i) {
        commandList += commands[i].symbol + ((i < commands.length - 1) ? ", " : "");
    }
    message.channel.sendMessage(`Current commands: ${commandList}`);
}

var giveCaseWarning = function (message, commandSymbol) {
    message.reply(`did you mean "${commandSymbol}"? Commands are case-sensitive.`);
}

var displayHelpMessage = function (message, args, botCreatorUser) {
    if (args.length == 0) {
        let helpChannel = (message.guild != null) ? message.guild.channels.find("name", "help") : null;
        message.channel.sendMessage(`If you'd like help with specific command syntax, please use "!help <commandName>".` +
                                    `\nIf you'd like to see available commands, please use "!commands".` +
                                    ((helpChannel != null) ? `\nIf you need help with Discord or something not specific to a class, please ask a question in ${helpChannel}.` : ``));
    } else {
        let commandArg = args[0];
        var isValidCommand = false;
        commands.forEach(command => {
            if (commandArg.toLowerCase() === `${command.symbol}`.toLowerCase()) {
                isValidCommand = true;
                if (commandArg === command.symbol) {
                    message.channel.sendMessage(`Usage: ` + command.usage + "\nInfo: " + command.info);
                } else {
                    giveCaseWarning(message, command.symbol);
                }
            }
        });
        
        if (!isValidCommand) {
            message.channel.sendMessage(`Unrecognized command. See !help for more information or !commands for a list of valid commands.`);
        }
    }
}

client.on("ready", () => {
    console.log("Boot sequence complete.");
    client.user.setGame("Banhammer 40k");
});

client.on("message", message => {
    try {
        if (message.author.bot) {
            return;
        }
        if (!message.content.startsWith(commandPrefix)) {
            return;
        }

        console.log(`[${message.createdAt}] ${message.author} (${message.author.username}): ${message.content}`);

        let args = message.content.trim().split(/\s+/);
        let messageCommandText = args.shift();
        let givenCommand = commands.find(com => { if (com.symbol === messageCommandText.substring(1)) return true; });
        let requiresGuild = (givenCommand != null) ? givenCommand.requiresGuild : false;
        let authorMember = (message.guild != null) ? message.guild.member(message.author) : null;

        if (requiresGuild && authorMember == null) {
            message.reply("The given command requires a guild, but no matching guildMember was found. Please make sure you aren't using this command in a private message.");
            return;
        } else if (requiresGuild) {
            let hasNeededPermissions = true;
            givenCommand.permissions.forEach(perm => { if (!authorMember.hasPermission(perm)) { hasNeededPermissions = false; }  });
            if (!hasNeededPermissions) {
                message.reply("you do not have permission to use this command.");
                return;
            }
        }
        
        let botCreatorMember = null, botCreatorUser = null;
        if (message.guild == null || (botCreatorMember = message.guild.members.get(botCreatorID)) == null) {
            botCreatorUser = "Natrastellar";
        } else {
            botCreatorUser = botCreatorMember.user;
        }

        if (givenCommand == null) {
            // No valid command was found; check if the message didn't match casing
            commands.forEach(com => {
                if (messageCommandText === `${commandPrefix}${com.symbol}`.toLowerCase()) {
                    giveCaseWarning(message, com.symbol);
                }
            });
        } else {
            if (givenCommand.symbol === `help`) {
                displayHelpMessage(message, args, botCreatorUser);
            }

            else if (givenCommand.symbol === `about`) {
                message.channel.sendMessage(`Currently running on version ${info.version}. Created in 2017 by Natrastellar.`);
            }

            else if (givenCommand.symbol === `commands`) {
                listCommands(message);
            }

            else if (givenCommand.symbol === `addClass` || givenCommand.symbol === `removeClass`) {
                if (message.guild == null) {
                    message.reply("No guild to change roles. Please note that this command does not work in private messages.");
                    return;
                }
                let member = message.guild.member(message.author);
                let adding = (givenCommand.symbol === `addClass`);
                changeClassForMember(member, message, args, adding);
            }

            else if (givenCommand.symbol === `addClassTo` || givenCommand.symbol === `removeClassFrom`) {
                if (message.guild == null) {
                    message.reply("No guild to change roles. Please note that this command does not work in private messages.");
                    return;
                }
                if (args.length < 1) {
                    message.channel.sendMessage("You must enter a user.");
                    return;
                }
                let memberName = args.shift();
                // Follow member nickname conventions
                memberName = memberName.substr(0, memberName.length - 1).concat(" ").concat(memberName.charAt(memberName.length - 1)); // e.g. "NatR" becomes "Nat R"
                let member = message.guild.members.find("displayName", memberName);
                let adding = (givenCommand.symbol === `addClassTo`);
                changeClassForMember(member, message, args, adding);
            }
        }
    } catch (err) {
        console.log("Error on message event:\n" + err.message + " " + err.fileName + " " + err.lineNumber);
    }
});

client.on("guildMemberAdd", member => {
    let guild = member.guild;
    try {
        let welcomeChannel = guild.channels.find("name", "welcome");
        guild.channels.find("name", "general").sendMessage(`Please welcome ${member.user} to the server!` +
                                                           `\n${member.user.username}, please read through the rules` + ((welcomeChannel != null) ? ` in ${welcomeChannel}` : ``) + 
                                                           ` and assign yourself a nickname in the format "FirstName LastInitial", e.g. "/nick Suzy Q".`);
    } catch (err) {
        console.log("Error on guildMemberAdd event:\n" + err.message + " " + err.fileName + " " + err.lineNumber);
    }
});

client.login(token);