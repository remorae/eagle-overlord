import { Message, GuildMember, TextChannel, PermissionString, NewsChannel } from 'discord.js';
import { parseCachedUser, parseCachedChannel, parseCachedRole, getAuthorMember, getCachedChannel } from './utils';
import { CommandSettings, findServer } from './settings';
import { changeRolesForMember, processAddRole } from './roles';
import { welcome } from './welcome';
import { handleACM } from './acm';
import { displayLeaderboard, linkCurrentAdventOfCodePage, displayNextUnlock } from './adventOfCode';
import { doCompileCommand } from './compile';
import { handleCSC } from './csc';
import { handleEmbed } from './embed';
import { displayHelpMessage } from './help';
import { ErrorFunc } from './error';
import { NonVoiceChannel } from './types';
import * as config from './config.json'
import * as path from 'path'

function listCommands(message: Message): void {
    const server = findServer(message.guild);
    const commands = server ? server.commands : config.legacy.commands;

    const authorMember = getAuthorMember(message);

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
                if (!authorMember.permissions.has(required)) {
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
            const getUserID = () => {
                const gm = parseCachedUser(message, args[1]);
                if (!gm)
                    message.author.send(`User not found.`);
                else if (gm instanceof GuildMember)
                    message.author.send(`User ${args[1]}: ${gm.id}`);
            };
            if (message.guild) {
                message.guild.members.fetch().then(getUserID);
            }
            else {
                getUserID();
            }
            break;
        }
        case `channel`: {
            const getChannelID = () => {
                const channel = parseCachedChannel(message, args[1]);
                if (!channel)
                    message.author.send(`Channel not found.`);
                else
                    message.author.send(`Channel ${args[1]}: ${channel.id}`);
            };
            if (message.guild) {
                message.guild.channels.fetch().then(getChannelID);
            }
            else {
                getChannelID();
            }
            break;
        }
        case `role`: {
            const getRoleID = () => {
                const role = parseCachedRole(message.guild!, args[1]);
                if (!role)
                    message.author.send(`Role not found.`);
                else
                    message.author.send(`Role ${args[1]}: ${role.id}`);
            };
            if (message.guild) {
                message.guild.roles.fetch().then(getRoleID);
            }
            else {
                getRoleID();
            }
            break;
        }
    }
}

export function handleCommand(givenCommand: CommandSettings,
    message: Message, reportError: ErrorFunc): void {
    const authorMember = getAuthorMember(message);

    if (givenCommand.requiresGuild) {
        if (!message.guild) {
            message.reply(`the given command requires a guild. Please make sure you aren't using this command in a private message.`);
            return;
        }

        if (!authorMember) {
            reportError(`Could not get GuildMember: ${message.author.id}`);
            return;
        }

        for (const permission of givenCommand.permissions) {
            const required = permission as PermissionString;
            if (!authorMember.permissions.has(required)) {
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
            displayHelpMessage(message, args);
            break;
        case `aboutCommand`:
            {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const infoFile = require(path.resolve(require.main!.filename, '..', 'package.json'));
                message.channel.send(`Currently running on version ${infoFile.version}. Created in 2021 by ${config.legacy.botCreatorName}.`);
            }
            break;
        case `listCommandsCommand`:
            listCommands(message);
            break;
        case `addRoleCommand`:
        case `removeRoleCommand`: {
            if (!authorMember) {
                reportError(`Could not get GuildMember: ${message.author.id}`);
                return;
            }
            const adding = (givenCommand.name === `addRoleCommand`);
            changeRolesForMember(authorMember, message, args, adding, false, true, true, reportError);
            break;
        }
        case `addRoleToOtherCommand`:
        case `removeRoleFromOtherCommand`: {
            if (args.length < 1) {
                message.channel.send(`Missing argument(s).`);
                return;
            }
            message.guild?.members.fetch().then(() => {
                const member = parseCachedUser(message, args[0]);
                const adding = (givenCommand.name === `addRoleToOtherCommand`);
                if (member) {
                    const allowPings = member instanceof GuildMember;
                    changeRolesForMember(member, message, args, adding, true, false, allowPings, reportError);
                }
            });
            break;
        }
        case `testWelcomeCommand`: {
            if (args.length < 1) {
                message.channel.send(`Missing argument(s).`);
                return;
            }
            message.guild?.members.fetch().then(() => {
                const member = parseCachedUser(message, args[0]);
                if (member instanceof GuildMember) {
                    welcome(member, reportError);
                }
            });
            break;
        }
        case `acmCommand`:
            handleACM(message, args);
            break;
        case `getIDCommand`:
            getID(message, args);
            break;
        case `shrugCommand`:
            message.channel.send(`¯\\_(ツ)_/¯`);
            break;
        case `sayCommand`: {
            if (args.length === 0) {
                message.channel.send(`Missing message. See \`!help say\` for more info.`);
                return;
            }
            const getChannel = () => {
                if (args.length > 1) {
                    if (!message.guild) {
                        message.channel.send(`Not in a guild; can't !say something in a different channel.`)
                        return Promise.reject();
                    }
                    return Promise.resolve(getCachedChannel(message.guild, args[1]) as TextChannel);
                }
                return Promise.resolve(message.channel);
            };
            getChannel()
            .then((channel) => {
                const msg = args[0].replace(/"/g, ``);
                channel.send(msg);
            })
            .catch(() => {
                message.channel.send(`There is no channel "${args[1]}".`)
            });
            break;
        }
        case `hungCommand`:
            if (message.author.id === config.legacy.hungID) {
                message.author.send(`Hello there.`);
            } else {
                message.channel.send(`No.`);
            }
            break;
        case `stuCommand`:
            if (message.author.id === config.legacy.stuID) {
                message.author.send(`ʕ •ᴥ•ʔ All aboard Stu's Happyland Express ʕ •ᴥ•ʔ`);
            } else {
                message.channel.send(`Stu.`);
            }
            break;
        case `compileCommand`:
            doCompileCommand(message, args, reportError);
            break;
        case `cscCommand`:
            handleCSC(message, args);
            break;
        case `grantRoleCommand`:
            processAddRole(message, args, reportError);
            break;
        case `adventOfCodeCommand`:
            if (args.length == 0 && !(message.channel instanceof NewsChannel)) {
                const showSummary = (fullChannel: NonVoiceChannel) => {
                    linkCurrentAdventOfCodePage(fullChannel);
                    displayNextUnlock(fullChannel);
                };
                if (message.channel.partial) {
                    message.channel.fetch()
                    .then(showSummary)
                    .catch(reportError)
                }
                else {
                    showSummary(message.channel);
                }
            } else {
                switch (args[0]) {
                    default:
                        break;
                    case `leaderboard`:
                        if (!message.guild) {
                            return;
                        }
                        {
                            let year = new Date().getFullYear().toString();
                            if (args.length > 1) {
                                year = args[1];
                            }
                            displayLeaderboard(message.channel as TextChannel, year, reportError);
                        }
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