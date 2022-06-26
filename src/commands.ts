import { Message, TextChannel, PermissionString, NewsChannel, ThreadChannel, GuildMember } from 'discord.js';
import { getAuthorMember, parseCachedUser } from './utils.js';
import type { CommandSettings } from './settings.js';
import { displayLeaderboard, linkCurrentAdventOfCodePage, displayNextUnlock } from './adventOfCode.js';
import { doCompileCommand } from './compile.js';
import { handleEmbed } from './embed.js';
import type { ErrorFunc } from './error.js';
import type { NonVoiceChannel } from './types.js';
import { welcome } from './welcome.js';

export async function handleNonCommand(message: Message): Promise<void> {
    const matches = message.content.match(/(^|[^\w]+)\/r\/\w+/i);
    if (matches) {
        const url = matches[0]?.trim().toLowerCase();
        await message.channel.send(`<http://www.reddit.com${url}>`);
    }
}

export async function handleCommand(givenCommand: CommandSettings,
    message: Message, reportError: ErrorFunc): Promise<void> {
    const authorMember = getAuthorMember(message);

    if (givenCommand.requiresGuild) {
        if (!message.guild) {
            await message.reply('the given command requires a guild. Please make sure you aren\'t using this command in a private message.');
            return;
        }

        if (!authorMember) {
            await reportError(`Could not get GuildMember: ${message.author.id}`);
            return;
        }

        for (const permission of givenCommand.permissions) {
            const required = permission as PermissionString;
            if (!authorMember.permissions.has(required)) {
                await message.reply('you do not have permission to use this command.');
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
    case 'testWelcomeCommand': {
        const arg = args[0];
        if (!arg) {
            await message.channel.send('Missing argument(s).');
            return;
        }
        await message.guild?.members.fetch();
        const member = await parseCachedUser(message, arg);
        if (member instanceof GuildMember) {
            await welcome(member, reportError);
        }
        break;
    }
    case 'compileCommand':
        await doCompileCommand(message, args, reportError);
        break;
    case 'adventOfCodeCommand':
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
            case 'leaderboard':
                if (!message.guild) {
                    return;
                }
                {
                    const year = args[1] ?? new Date().getFullYear().toString();
                    await displayLeaderboard(message.channel as (TextChannel | ThreadChannel), year, reportError);
                }
                break;
            }
        }
        break;
    case 'embedCommand':
        await handleEmbed(message, args, reportError);
        break;
    default:
        await reportError(`Bad command name: ${givenCommand.name}`);
        break;
    }
}