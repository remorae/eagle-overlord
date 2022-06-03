import { Message, GuildMember, TextChannel, PermissionString, NewsChannel, TextBasedChannels, ThreadChannel } from 'discord.js';
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
import * as config from './config.json';
import * as path from 'path';

async function listCommands(message: Message): Promise<void> {
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
    await message.channel.send(`Current commands: ${commandList}`);
}

export async function handleNonCommand(message: Message): Promise<void> {
    const matches = message.content.match(/(^|[^\w]+)\/r\/\w+/i);
    if (matches) {
        const url = matches[0].trim().toLowerCase();
        await message.channel.send(`<http://www.reddit.com${url}>`);
    }
}

async function getID(message: Message, args: string[]): Promise<void> {
    if (args.length < 2) {
        await message.channel.send(`Missing parameter(s). See \`!help getID\` for more info.`);
        return;
    }
    switch (args[0]) {
        case `user`: {
            if (message.guild) {
                await message.guild.members.fetch();
            }
            const gm = await parseCachedUser(message, args[1]);
            if (!gm)
                await message.author.send(`User not found.`);
            else if (gm instanceof GuildMember)
                await message.author.send(`User ${args[1]}: ${gm.id}`);
            break;
        }
        case `channel`: {
            if (message.guild) {
                await message.guild.channels.fetch();
            }
            const channel = parseCachedChannel(message, args[1]);
            if (!channel)
                await message.author.send(`Channel not found.`);
            else
                await message.author.send(`Channel ${args[1]}: ${channel.id}`);
            break;
        }
        case `role`: {
            if (message.guild) {
                await message.guild.roles.fetch();
            }
            const role = parseCachedRole(message.guild!, args[1]);
            if (!role)
                await message.author.send(`Role not found.`);
            else
                await message.author.send(`Role ${args[1]}: ${role.id}`);
            break;
        }
    }
}

export async function handleCommand(givenCommand: CommandSettings,
    message: Message, reportError: ErrorFunc): Promise<void> {
    const authorMember = getAuthorMember(message);

    if (givenCommand.requiresGuild) {
        if (!message.guild) {
            await message.reply(`the given command requires a guild. Please make sure you aren't using this command in a private message.`);
            return;
        }

        if (!authorMember) {
            await reportError(`Could not get GuildMember: ${message.author.id}`);
            return;
        }

        for (const permission of givenCommand.permissions) {
            const required = permission as PermissionString;
            if (!authorMember.permissions.has(required)) {
                await message.reply(`you do not have permission to use this command.`);
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
            await displayHelpMessage(message, args);
            break;
        case `aboutCommand`:
            {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const infoFile = require(path.resolve(require.main!.filename, '..', 'package.json'));
                await message.channel.send(`Currently running on version ${infoFile.version}. Created in 2021 by ${config.legacy.botCreatorName}.`);
            }
            break;
        case `listCommandsCommand`:
            await listCommands(message);
            break;
        case `addRoleCommand`:
        case `removeRoleCommand`: {
            if (!authorMember) {
                await reportError(`Could not get GuildMember: ${message.author.id}`);
                return;
            }
            const adding = (givenCommand.name === `addRoleCommand`);
            await changeRolesForMember(authorMember, message, args, adding, false, true, true, reportError);
            break;
        }
        case `addRoleToOtherCommand`:
        case `removeRoleFromOtherCommand`: {
            if (args.length < 1) {
                await message.channel.send(`Missing argument(s).`);
                return;
            }
            await message.guild?.members.fetch();
            const member = await parseCachedUser(message, args[0]);
            const adding = (givenCommand.name === `addRoleToOtherCommand`);
            if (member) {
                const allowPings = member instanceof GuildMember;
                await changeRolesForMember(member, message, args, adding, true, false, allowPings, reportError);
            }
            break;
        }
        case `testWelcomeCommand`: {
            if (args.length < 1) {
                await message.channel.send(`Missing argument(s).`);
                return;
            }
            await message.guild?.members.fetch();
            const member = await parseCachedUser(message, args[0]);
            if (member instanceof GuildMember) {
                await welcome(member, reportError);
            }
            break;
        }
        case `acmCommand`:
            await handleACM(message, args);
            break;
        case `getIDCommand`:
            await getID(message, args);
            break;
        case `shrugCommand`:
            await message.channel.send(`¯\\_(ツ)_/¯`);
            break;
        case `sayCommand`: {
            if (args.length === 0) {
                await message.channel.send(`Missing message. See \`!help say\` for more info.`);
                return;
            }
            let channel: TextBasedChannels | null = null;
            if (args.length > 1) {
                if (!message.guild) {
                    await message.channel.send(`Not in a guild; can't !say something in a different channel.`);
                }
                else {
                    const specifiedChannel = getCachedChannel(message.guild, args[1]);
                    if (specifiedChannel instanceof TextChannel || specifiedChannel instanceof ThreadChannel) {
                        channel = specifiedChannel;
                    }
                    else {
                        await message.channel.send(`Invalid channel "${args[1]}".`);
                        channel = null;
                    }
                }
            }
            else {
                channel = message.channel;
            }
            if (channel) {
                const msg = args[0].replace(/"/g, ``);
                await channel.send(msg);
            }
            break;
        }
        case `hungCommand`:
            if (message.author.id === config.legacy.hungID) {
                await message.author.send(`Hello there.`);
            } else {
                await message.channel.send(`No.`);
            }
            break;
        case `stuCommand`:
            if (message.author.id === config.legacy.stuID) {
                await message.author.send(`ʕ •ᴥ•ʔ All aboard Stu's Happyland Express ʕ •ᴥ•ʔ`);
            } else {
                await message.channel.send(`Stu.`);
            }
            break;
        case `compileCommand`:
            await doCompileCommand(message, args, reportError);
            break;
        case `cscCommand`:
            await handleCSC(message, args);
            break;
        case `grantRoleCommand`:
            await processAddRole(message, args, reportError);
            break;
        case `adventOfCodeCommand`:
            if (args.length == 0 && !(message.channel instanceof NewsChannel)) {
                try {
                    const fullChannel = await message.channel.fetch() as NonVoiceChannel;
                    await linkCurrentAdventOfCodePage(fullChannel);
                    await displayNextUnlock(fullChannel);
                }
                catch (e) {
                    await reportError(e);
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
                            await displayLeaderboard(message.channel as (TextChannel | ThreadChannel), year, reportError);
                        }
                        break;
                }
            }
            break;
        case `embedCommand`:
            await handleEmbed(message, args, reportError);
            break;
        default:
            await reportError(`Bad command name: ${givenCommand.name}`);
            break;
    }
}