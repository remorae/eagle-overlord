import { Message, GuildMember, TextChannel, PermissionString, NewsChannel, ThreadChannel } from 'discord.js';
import { parseCachedUser, getAuthorMember } from './utils';
import { CommandSettings } from './settings';
import { welcome } from './welcome';
import { displayLeaderboard, linkCurrentAdventOfCodePage, displayNextUnlock } from './adventOfCode';
import { doCompileCommand } from './compile';
import { handleEmbed } from './embed';
import { ErrorFunc } from './error';
import { NonVoiceChannel } from './types';
import * as config from './config.json';

export async function handleNonCommand(message: Message): Promise<void> {
    const matches = message.content.match(/(^|[^\w]+)\/r\/\w+/i);
    if (matches) {
        const url = matches[0].trim().toLowerCase();
        await message.channel.send(`<http://www.reddit.com${url}>`);
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