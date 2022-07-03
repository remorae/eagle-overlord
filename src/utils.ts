import { Message, Guild, GuildMember, GuildChannel, ThreadChannel, User } from 'discord.js';
import Path from 'path';

export async function parseCachedUser(message: Message, arg: string): Promise<GuildMember | Iterable<GuildMember> | null> {
    if (!message.guild) {
        await message.channel.send('This command requires a guild.');
        return null;
    }
    switch (arg) {
        case null:
            await message.channel.send('You must enter a user.');
            return null;
        case 'all':
            return message.guild.members.cache.values();
        default:
            break;
    }
    let gm = getCachedMember(message.guild, arg);
    if (!gm) {
        gm = getMemberByUserName(message.guild, arg);
    }
    if (!gm && isQuoteDelimited(arg)) {
        gm = getMemberByDisplayName(message.guild, arg.slice(1, -1));
    }
    return gm;
}

function isQuoteDelimited(arg: string) {
    return arg.length > 2 &&
        arg[0] === arg[-1] &&
        (arg[0] === '"' || arg[0] === '\'' || arg[0] === '`');
}

export function parseCachedChannel(message: Message, arg: string): GuildChannel | ThreadChannel | null {
    let ch = message.guild?.channels.cache.find(c => c.id === arg);
    if (!ch) {
        ch = message.guild?.channels.cache.find(c => c.name === arg);
    }
    if (!ch && isQuoteDelimited(arg)) {
        ch = message.guild?.channels.cache.find(c => c.name === arg.slice(1, -1));
    }
    return ch ? ch : null;
}

export function getCachedMember(guild: Guild, user: string | User): GuildMember | null {
    const id = user instanceof User ? user.id : user;
    return guild.members.cache.get(id) ?? null;
}

export function getMemberByUserName(guild: Guild, name: string): GuildMember | null {
    return guild.members.cache.find(m => m.user.username === name) ?? null;
}

export function getMemberByDisplayName(guild: Guild, name: string): GuildMember | null {
    return guild.members.cache.find(m => m.displayName === name) ?? null;
}

export function getAuthorMember(message: Message): GuildMember | null {
    if (message.guild) {
        return getCachedMember(message.guild, message.author);
    }
    return null;
}

export function getCachedChannel(guild: Guild, channel: string): GuildChannel | ThreadChannel | null {
    return guild.channels.cache.get(channel) ?? null;
}

export function loadAtRuntime(path: string, reload: boolean) {
    if (reload) {
        delete require.cache[path];
    }
    return require(path);
}

export function resolveRelativeToMain(relativePath: string): string | null {
    if (require.main) {
        return Path.resolve(Path.dirname(require.main.filename), ...relativePath.split('/'));
    }
    return null;
}

export function loadRelativeToMain(relativePath: string, reload: boolean) {
    const absolutePath = resolveRelativeToMain(relativePath);
    if (absolutePath) {
        return loadAtRuntime(absolutePath, reload);
    }
    return null;
}