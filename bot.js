const Discord = require("discord.js");
const client = new Discord.Client({autoReconnect: true});
const infoFile = require("./package.json");
const settingsFile = require("./settings.json");
const fs = require(`fs`);

const token = settingsFile.token;
const botID = settingsFile.botID;
const botCreatorID = settingsFile.botCreatorID;
const commandPrefix = settingsFile.commandPrefix;
const validClassPrefixes = settingsFile.validClassPrefixes;
const commands = settingsFile.commands;

var changeClassForMember = function (member, message, args, adding, isForOther) { 
    if (message.guild == null || message.guild.channels.get(message.channel.id).name === "general") {
        return;
    }
    if (member == null) {
        message.channel.sendMessage("Invalid guildMember.");
    } else if (args.length < 1) {
        message.channel.sendMessage("You must enter a class.");
    } else {
        let changingForOther = (member.user.id != message.author.id);
        for (let i = (isForOther) ? 1 : 0; i < args.length; ++i) {
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
                                if (!changingForOther && settingsFile.alwaysVisibleClasses.find(vclass => { return vclass.toUpperCase() === classToChange.toUpperCase(); }) != null) {
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

var logMessage = function (message) {
    console.log(`[${message.createdAt}] ${message.author} (${message.author.username}): ${message.content}`);
}

var handleNonCommand = function (message) {
    var matches = message.content.match(/(^|[^\w]+)\/r\/\w+/i);
    if (matches != null) {
        logMessage(message);
        let url = matches[0].trim().toLowerCase();
        message.channel.sendMessage(`<http://www.reddit.com` + url + `>`);
        console.log(`Attempting to link subreddit <http://www.reddit.com` + url + `>`);
    }
}

var getUserFromArgs = function (message, args) {
    if (message.guild == null) {
        message.reply(`No guild found. Please note that this command does not work in private messages.`);
        return;
    }
    if (args.length < 1) {
        message.channel.sendMessage(`You must enter a user.`);
        return;
    }
    let memberName = args[0];
    memberName = memberName.substr(1, memberName.length - 2);
    return message.guild.members.find(`displayName`, memberName);
}

var addQuote = function (message, args) {
    if (args.length == 0) {
        message.channel.fetchMessages("before", message.id).then(results => {
            let filtered = results.filter(function (item) { 
                return item.author.id != botID && item.id != message.id; 
            }).array();
            filtered.sort(function compare(o1, o2) { 
                if (o1.createdTimestamp > o2.createdTimestamp) {
                    return 1;
                }
                if (o1.createdTimestamp < o2.createdTimestamp) {
                    return -1;
                }
                return 0;
            });
            let toQuote = filtered[filtered.length - 1];
            logQuote(message, toQuote);
        }).catch(error => {
            console.log(error);
        });
    } else {
        let messageID = args[0];
        message.channel.fetchMessage(messageID).then(result => {
            let toQuote = result;
            logQuote(message, toQuote);
        }).catch(error => {
            message.channel.sendMessage("Invalid message ID.");
        });
    }
}

var logQuote = function (message, toQuote) {
    if (toQuote === null) {
        message.channel.sendMessage("Invalid quote!");
    } else {
        fs.readFile(`./quotes.json`, function (err, content) {
            if (err) console.log(err);
            let obj = JSON.parse(content);
            try {
                obj.quotes.push({
                    id: toQuote.id,
                    author: toQuote.author.id,
                    time: toQuote.createdAt,
                    text: toQuote.content
                });
                fs.writeFile(`./quotes.json`, JSON.stringify(obj), function (err) {
                    if (err) console.log(err);
                });
                message.channel.sendMessage("Quote " + toQuote.id + " added!");
            } catch (err) {
                console.log(err);
            }
        });
    }
}

var displayQuote = function (message, args) {
    fs.readFile(`./quotes.json`, function (err, content) {
        if (err) console.log(err);
        let obj = JSON.parse(content);

        if (args.length >= 1) {
            let author = getUserFromArgs(message, args);
            if (author != null) {
                var authorID = author.id;
            } else {
                message.channel.sendMessage("Invalid user!");
                return;
            }
            var quoteResults = obj.quotes.filter(function (item) { return item.author === authorID; });
        } else {
            var quoteResults = obj.quotes;
        }

        if (quoteResults.length == 0) {
            message.channel.sendMessage("Sorry, no quotes available :(");
        } else {
            let i = Math.floor(Math.random() * quoteResults.length);
            let quote = quoteResults[i];
            let author = message.guild.members.get(quote.author);
            let time = new Date(Date.parse(quote.time));
            let minutes = (time.getMinutes() >= 10) ? time.getMinutes() : ("0" + time.getMinutes());
            message.channel.sendMessage("```" + author.displayName + 
                " at " + time.getHours() + ":" + minutes +
                " on " + (time.getMonth() + 1) + "/" + time.getDate() + "/" + time.getFullYear() + 
                ": " + quote.text + "```");
        }
    });
}

var listQuotes = function (message, args) {
    fs.readFile(`./quotes.json`, function (err, content) {
        if (err) console.log(err);
        let obj = JSON.parse(content);

        if (args.length >= 1) {
            let authorID = getUserFromArgs(message, args).id;
            var quoteResults = obj.quotes.filter(function (item) { return item.author === authorID; });
        } else {
            var quoteResults = obj.quotes;
        }

        if (quoteResults.length == 0) {
            message.author.sendMessage("Sorry, no quotes available :(");
        } else {
            quoteResults.forEach(quote => {
            let author = message.guild.members.get(quote.author);
            let time = new Date(Date.parse(quote.time));
            let minutes = (time.getMinutes() >= 10) ? time.getMinutes() : ("0" + time.getMinutes());
            message.author.sendMessage("```" + quote.id + " - " + author.displayName + 
                " at " + time.getHours() + ":" + minutes +
                " on " + (time.getMonth() + 1) + "/" + time.getDate() + "/" + time.getFullYear() + 
                ": " + quote.text + "```");
            });
        }
    });
}

var removeQuote = function (message, args) {
    if (args.length < 1) {
        message.channel.reply("You must enter a quote ID!");
    }
    let toRemoveID = args[0];
    fs.readFile(`./quotes.json`, function (err, content) {
        if (err) console.log(err);
        let obj = JSON.parse(content);
        try {
            let removed = obj.quotes.splice(obj.quotes.findIndex(item => item.id === toRemoveID), 1);
            fs.writeFile(`./quotes.json`, JSON.stringify(obj), function (err) {
                if (err) console.log(err);
            });
            if (removed.length == 0) {
                message.channel.sendMessage("Invalid quote ID.");
            } else {
                removed.forEach(quote => {
                    message.channel.sendMessage("Quote " + quote.id + " removed!");
                })
            }
        } catch (err) {
            console.log(err);
        }
    });
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
            handleNonCommand(message);
            return;
        }

        // logMessage(message);

        let args = message.content.trim().match(/\w+|"(?:\\"|[^"])+"/g);
        let messageCommandText = args.shift();
        let givenCommand = commands.find(com => { if (com.symbol === messageCommandText) return true; });
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
                message.channel.sendMessage(`Currently running on version ${infoFile.version}. Created in 2017 by Natrastellar.`);
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
                changeClassForMember(member, message, args, adding, false);
            }

            else if (givenCommand.symbol === `addClassTo` || givenCommand.symbol === `removeClassFrom`) {
                let member = getUserFromArgs(message, args);
                let adding = (givenCommand.symbol === `addClassTo`);
                changeClassForMember(member, message, args, adding, true);
            }

            else if (givenCommand.symbol === `welcome`) {
                let member = getUserFromArgs(message, args);
                let moderatorRole = message.guild.roles.find(role => role.name.toLowerCase() === "moderators");
                message.channel.sendMessage(`Please welcome ${member.user} to the server!` +
                                            `\n${member.user.username}, please read through the rules.` + 
                                            `\nIf you have any questions, please feel free to mention ${moderatorRole} in #help and we can assist you.`);
            }

            // else if (givenCommand.symbol === `addQuote`) {
            //     addQuote(message, args);
            // }

            // else if (givenCommand.symbol === `quote`) {
            //     displayQuote(message, args);
            // }

            // else if (givenCommand.symbol === `listQuotes`) {
            //     listQuotes(message, args);
            // }

            // else if (givenCommand.symbol === `removeQuote`) {
            //     removeQuote(message, args);
            // }
        }
    } catch (err) {
        console.log("Error on message event:\n" + err.message + " " + err.fileName + " " + err.lineNumber);
    }
});

client.on("guildMemberAdd", member => {
    let guild = member.guild;
    try {
        let welcomeChannel = guild.channels.find("name", "welcome");
        let helpChannel = guild.channels.find("name", "help");
        let moderatorRole = guild.roles.find(role => role.name.toLowerCase() === "moderators");
        guild.channels.find("name", "general").sendMessage(`Please welcome ${member.user} to the server!` +
                                                           `\n${member.user.username}, please read through the rules` + ((welcomeChannel != null) ? ` in ${welcomeChannel}.` : `.`) + 
                                                           `\nIf you have any questions, please feel free to mention ${moderatorRole} in ${helpChannel} and we can assist you.`);
    } catch (err) {
        console.log("Error on guildMemberAdd event:\n" + err.message + " " + err.fileName + " " + err.lineNumber);
    }
});

client.login(token);