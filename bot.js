const Discord = require("discord.js");
const client = new Discord.Client();
const info = require("./package.json");
const settings = require("./settings.json");
const prefix = '!';

const botCreatorID = "177635814803505152";
const validClassPrefixes = ["CSCD", "MATH", "EENG", "PHYS", "CHEM", "GEOL", "PHIL", "DESN"];

// Command syntax
const helpCommand = "help"; //!help
const aboutCommand = "about" //!about
const listCommandsCommand = "commands"; //!commands
const addClassCommand = "addClass"; //!addClass <className>
const removeClassCommand = "removeClass"; //!removeClass <className>

client.on("ready", () => {
    console.log("Boot sequence complete.");
    client.user.setGame("Banhammer 40k");
});

client.on("message", message => {
    if (message.author.bot) {
        return;
    }
    if (!message.content.startsWith(prefix)) {
        return;
    }

    console.log(`[${message.createdAt}] ${message.author} (${message.author.username}): ${message.content}`);
    
    var botCreatorMember = message.guild.members.get(botCreatorID);

    if (message.content.startsWith(`${prefix}${helpCommand}`)) {
        message.channel.sendMessage("Sorry, but my creator has yet to implement a help feature. I suggest forming an angry mob and storming " + ((botCreatorMember == null) ? "Natrastellar" : botCreatorMember.user) + "'s castle.");
    }

    else if (message.content.startsWith(`${prefix}${aboutCommand}`)) {
        message.channel.sendMessage(`Currently running on version ${info.version}. Created in 2017 by Natrastellar.`);
    }

    else if (message.content.startsWith(`${prefix}${listCommandsCommand}`)) {
        message.channel.sendMessage(`Current commands: ${helpCommand}, ${aboutCommand}, ${listCommandsCommand}, ${addClassCommand}, ${removeClassCommand}`);
    }

    else if (message.content.startsWith(`${prefix}${addClassCommand}`)) {
        let classes = message.content.split(' ');
        if (classes.length == 1) {
            message.channel.sendMessage("You must enter a class.");
        } else {
            for (let i = 1; i < classes.length; ++i) {
                let classToAdd = classes[i];
                if (classToAdd != null) {
                    let isValidClass = false;
                    validClassPrefixes.forEach(prefix => {
                        if (classToAdd.toUpperCase().startsWith(prefix)) {
                            isValidClass = true;
                        }
                    });
        
                    if (!isValidClass) {
                        message.channel.sendMessage(`"${classToAdd}" is not a valid class.`);
                    } else {
                        let role = message.guild.roles.find("name", classToAdd.toUpperCase());
                        if (role != null) {
                            let authorMember = message.guild.member(message.author);
                            if (authorMember.roles.get(role.id) == null) {
                                authorMember.addRole(role).then(authorMember => {
                                    message.channel.sendMessage(`Added ${message.author} to class "${classToAdd}".`);
                                    console.log(`Added ${message.author} to class "${classToAdd}".`);
                                }).catch(authorMember => {
                                    message.channel.sendMessage("An error occurred. I probably don't have permissions to assign roles :'(");
                                });
                            } else {
                                message.reply(`you are already in class "${classToAdd}".`);
                            }
                        } else {
                            message.channel.sendMessage(`"${classToAdd}" is not a valid class or does not have a role created on the server.`);
                        }
                    }
                }
            }
        }
    }

    else if (message.content.startsWith(`${prefix}${removeClassCommand}`)) {
        let classes = message.content.split(' ');
        if (classes.length == 1) {
            message.channel.sendMessage("You must enter a class.");
        } else {
            for (let i = 1; i < classes.length; ++i) {
                let classToAdd = classes[i];
                if (classToAdd != null) {
                    let isValidClass = false;
                    validClassPrefixes.forEach(prefix => {
                        if (classToAdd.toUpperCase().startsWith(prefix)) {
                            isValidClass = true;
                        }
                    });
                    
                    if (!isValidClass) {
                        let botCreatorMember = message.guild.members.get(botCreatorID);
                        message.channel.sendMessage(`"${classToAdd}" is not a valid class.`);
                    } else {
                        let role = message.guild.roles.find("name", classToAdd.toUpperCase());
                        if (role != null) {
                            let authorMember = message.guild.member(message.author);
                            if (authorMember.roles.get(role.id) != null) {
                                authorMember.removeRole(role).then(authorMember => {
                                    message.channel.sendMessage(`Removed ${message.author} from class "${classToAdd}".`);
                                    console.log(`Removed ${message.author} from class "${classToAdd}".`);
                                }).catch(authorMember => {
                                    message.channel.sendMessage("An error occurred. I probably don't have permissions to assign roles :'(");
                                });
                            } else {
                                message.reply(`you are not in class "${classToAdd}".`);
                            }
                        } else {
                            message.channel.sendMessage(`"${classToAdd}" is not a valid class or does not have a role created on the server.`);
                        }
                    }
                }
            }
        }
    }
});

client.on("guildMemberAdd", member => {
    let guild = member.guild;
    guild.channels.find("name", "general").sendMessage(`Please welcome ${member.user.username} to the server!` +
                                                       `\n${member.user.username}, please read through the rules and assign yourself a nickname in the format "FirstName LastInitial", e.g. "Suzy Q".`);
});

client.login(settings.token);