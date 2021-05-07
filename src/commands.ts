import { Message, GuildMember, TextChannel, PermissionString, NewsChannel } from 'discord.js';
import { parseUser, parseChannel, parseRole } from './utils';
import { ClientSettings, CommandSettings } from './settings';
import { changeRolesForMember, processAddRole } from './roles';
import { welcome } from './welcome';
import { handleACM } from './acm';
import { displayLeaderboard, linkCurrentAdventOfCodePage, displayNextUnlock } from './adventOfCode';
import { doCompileCommand } from './compile';
import { handleCSC } from './csc';
import { handleEmbed } from './embed';
import { displayHelpMessage } from './help';
import { ErrorFunc } from './error';
const infoFile = require('../package.json');

function listCommands(message: Message, settings: ClientSettings): void {
    const server = message.guild
        ? settings.servers.find(s => s.id == message.guild?.id)
        : null;
    const commands = server ? server.commands : settings.commands;

    const authorMember = message.guild
        ? message.guild.members.cache.get(message.author.id)
        : null;

    const visibleCommands: CommandSettings[] = [];
    for (const command of commands) {
        if (!message.guild && command.requiresGuild) {
            continue;
        }
        if (command.visible) {
            visibleCommands.push(command);
            continue;
        }

        if (command.requiresGuild && authorMember) {
            for (const permission of command.permissions) {
                const required = permission as PermissionString;
                if (!authorMember.hasPermission(required)) {
                    continue;
                }
            }
            visibleCommands.push(command);
        }
    }

    let commandList = ``;
    for (const i in visibleCommands) {
        const remaining = (Number.parseInt(i) < visibleCommands.length - 1);
        commandList += `${visibleCommands[i].symbol}${(remaining ? `, ` : ``)}`;
    }
    message.channel.send(`Current commands: ${commandList}`);
}

export function handleNonCommand(message: Message): void {
    const matches = message.content.match(/(^|[^\w]+)\/r\/\w+/i);
    if (matches) {
        const url = matches[0].trim().toLowerCase();
        message.channel.send(`<http://www.reddit.com${url}>`);
    }
}

function getID(message: Message, args: string[]): void {
    if (args.length < 2) {
        message.channel.send(`Missing parameter(s). See \`!help getID\` for more info.`);
        return;
    }
    switch (args[0]) {
        case `user`: {
            const gm = parseUser(message, args[1]);
            if (!gm)
                message.author.send(`User not found.`);
            else if (gm instanceof GuildMember)
                message.author.send(`User ${args[1]}: ${gm.id}`);
            break;
        }
        case `channel`: {
            const channel = parseChannel(message, args[1]);
            if (!channel)
                message.author.send(`Channel not found.`);
            else
                message.author.send(`Channel ${args[1]}: ${channel.id}`);
            break;
        }
        case `role`: {
            const role = parseRole(message.guild!, args[1]);
            if (!role)
                message.author.send(`Role not found.`);
            else
                message.author.send(`Role ${args[1]}: ${role.id}`);
            break;
        }
    }
}

export function handleCommand(givenCommand: CommandSettings,
    message: Message, reportError: ErrorFunc, settings: ClientSettings): void {
    const authorMember = message.guild
        ? message.guild.members.cache.get(message.author.id)
        : null;

    if (givenCommand.requiresGuild) {
        if (!message.guild) {
            message.reply(`the given command requires a guild. Please make sure you aren't using this command in a private message.`);
            return;
        }

        const authorMember = message.guild.members.cache.get(message.author.id);
        if (!authorMember) {
            reportError(`Could not get GuildMember: ${message.author.id}`);
            return;
        }

        for (const permission of givenCommand.permissions) {
            const required = permission as PermissionString;
            if (!authorMember.hasPermission(required)) {
                message.reply(`you do not have permission to use this command.`);
                return;
            }
        }
    }

    const args = message.content.trim()
        .match(/[\w-_]+|"(?:\\"|[^"])+"|```(\w+\n)?([\s\S]+)```/gm);
    if (!args) {
        return;
    }
    args.shift();

    switch (givenCommand.name) {
        case `helpCommand`:
            displayHelpMessage(message, args, settings);
            break;
        case `aboutCommand`:
            message.channel.send(`Currently running on version ${infoFile.version}. Created in 2020 by ${settings.botCreatorName}.`);
            break;
        case `listCommandsCommand`:
            listCommands(message, settings);
            break;
        case `addRoleCommand`:
        case `removeRoleCommand`: {
            if (!authorMember) {
                reportError(`Could not get GuildMember: ${message.author.id}`);
                return;
            }
            const adding = (givenCommand.name === `addRoleCommand`);
            changeRolesForMember(authorMember, message, args, adding, false, true, true, reportError, settings);
            break;
        }
        case `addRoleToOtherCommand`:
        case `removeRoleFromOtherCommand`: {
            if (args.length < 1) {
                message.channel.send(`Missing argument(s).`);
                return;
            }
            const member = parseUser(message, args[0]);
            const adding = (givenCommand.name === `addRoleToOtherCommand`);
            if (member) {
                changeRolesForMember(member, message, args, adding, true, false, !(member instanceof Array), reportError, settings);
            }
            break;
        }
        case `testWelcomeCommand`: {
            if (args.length < 1) {
                message.channel.send(`Missing argument(s).`);
                return;
            }
            const member = parseUser(message, args[0]);
            if (member instanceof GuildMember) {
                welcome(member, settings, reportError);
            }
            break;
        }
        case `acmCommand`:
            handleACM(message, args, settings);
            break;
        case `getIDCommand`:
            getID(message, args);
            break;
        case `shrugCommand`:
            message.channel.send(`¯\\\_(ツ)\_/¯`);
            break;
        case `sayCommand`: {
            if (args.length === 0) {
                message.channel.send(`Missing message. See \`!help say\` for more info.`);
                return;
            }
            const msg = args[0].replace(/\"/g, ``);
            let channel = message.channel;
            if (args.length > 1) {
                if (!message.guild) {
                    message.channel.send(`Not in a guild; can't !say something in a different channel.`)
                    return;
                }
                channel = message.guild.channels.cache.get(args[1]) as TextChannel;
            }
            if (!channel) {
                message.channel.send(`There is no channel "${args[1]}".`)
                return;
            }
            channel.send(msg);
            break;
        }
        case `hungCommand`:
            if (message.author.id === settings.hungID) {
                message.author.send(`Hello there.`);
            } else {
                message.channel.send(`No.`);
            }
            break;
        case `stuCommand`:
            if (message.author.id === settings.stuID) {
                message.author.send(`ʕ •ᴥ•ʔ All aboard Stu's Happyland Express ʕ •ᴥ•ʔ`);
            } else {
                message.channel.send(`Stu.`);
            }
            break;
        case `compileCommand`:
            doCompileCommand(message, args, settings, reportError);
            break;
        case `cscCommand`:
            handleCSC(message, args, settings);
            break;
        case `grantRoleCommand`:
            processAddRole(message, args, settings, reportError);
            break;
        case `adventOfCodeCommand`:
            if (args.length == 0 && !(message.channel instanceof NewsChannel)) {
                linkCurrentAdventOfCodePage(message.channel);
                displayNextUnlock(message.channel);
            } else {
                switch (args[0]) {
                    default:
                        break;
                    case `leaderboard`:
                        if (!message.guild) {
                            return;
                        }
                        let year = new Date().getFullYear().toString();
                        if (args.length > 1) {
                            year = args[1];
                        }
                        displayLeaderboard(message.channel as TextChannel, year, reportError, settings);
                        break;
                }
            }
            break;
        case `embedCommand`:
            handleEmbed(message, args, reportError);
            break;
        default:
            reportError(`Bad command name: ${givenCommand.name}`);
            break;
    }
}