import type { Message, PermissionString } from 'discord.js';
import { getAuthorMember } from './utils.js';
import type { CommandSettings } from './settings.js';
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
        await message.reply("the given command requires a guild. Please make sure you aren't using this command in a private message.");
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
