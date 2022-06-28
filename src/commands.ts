import { Message, TextChannel, PermissionString, ThreadChannel, VoiceChannel, NewsChannel } from 'discord.js';
import { getAuthorMember } from './utils.js';
import type { CommandSettings } from './settings.js';
import { displayLeaderboard, linkCurrentAdventOfCodePage, displayNextUnlock } from './adventOfCode.js';
import { handleEmbed } from './embed.js';
import type { ErrorFunc } from './error.js';

export async function handleNonCommand(message: Message): Promise<void> {
    const matches = message.content.match(/(?:^|[^\w]+)\/r\/\w+/i);
    if (matches) {
        const url = matches[0]?.trim().toLowerCase();
        await message.channel.send(`<http://www.reddit.com${url}>`);
    }
}

export async function handleCommand(givenCommand: CommandSettings, message: Message, reportError: ErrorFunc): Promise<void> {
    if (!allowCommand(givenCommand, message)) {
        return;
    }

    const args = message.content.trim()
        .match(/[\w-_]+|"(?:\\"|[^"])+"|```(?:\w+\n)?(?:[\s\S]+)```/gm);
    if (!args) {
        return;
    }
    args.shift();

    switch (givenCommand.name) {
        case 'adventOfCodeCommand':
            await handleAdventOfCodeCommand(message, args, reportError);
            break;
        case 'embedCommand':
            await handleEmbed(message, args, reportError);
            break;
        default:
            await reportError(`Bad command name: ${givenCommand.name}`);
            break;
    }
}

async function allowCommand(givenCommand: CommandSettings, message: Message) {
    const authorMember = getAuthorMember(message);
    if (!authorMember) {
        await message.reply('the given command requires a guild. Please make sure you aren\'t using this command in a private message.');
        return false;
    }

    const authorHasAllPermissions = givenCommand.permissions
        .every((p) => authorMember.permissions.has(p as PermissionString));
    if (authorHasAllPermissions) {
        return true;
    }
    await message.reply('you do not have permission to use this command.');
    return false;
}

async function handleAdventOfCodeCommand(message: Message, args: string[], reportError: ErrorFunc) {
    switch (args[0]) {
        case 'leaderboard': {
            if (!message.guild) {
                return;
            }
            const year = args[1] ?? new Date().getFullYear().toString();
            await displayLeaderboard(message.channel as (TextChannel | ThreadChannel), year, reportError);
            break;
        }
        case null:
            await displayAdventOfCodeInfo(message, reportError);
            break;
        default:
            break;
    }
}

async function displayAdventOfCodeInfo(message: Message, reportError: ErrorFunc) {
    try {
        const fullChannel = await message.channel.fetch();
        if (!(fullChannel instanceof VoiceChannel) && !(fullChannel instanceof NewsChannel)) {
            await linkCurrentAdventOfCodePage(fullChannel);
            await displayNextUnlock(fullChannel);
        }
    }
    catch (e) {
        await reportError(e);
    }
}
