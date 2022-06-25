import { Message, Guild, GuildMember, GuildChannel, ThreadChannel, User } from 'discord.js';

export async function parseCachedUser(message: Message, arg: string): Promise<GuildMember | Iterable<GuildMember> | null> {
    if (message.guild == null) {
        await message.channel.send('This command requires a guild.');
        return null;
    }
    if (arg == null) {
        await message.channel.send('You must enter a user.');
        return null;
    }
    if (arg === 'all') {
        return message.guild.members.cache.values();
    }
    let gm = getCachedMember(message.guild, arg);
    if (!gm) {
        gm = message.guild.members.cache.find(m => m.user.username === arg) ?? null;
    }
    if (!gm && arg.length > 2 &&
        arg[0] == arg[arg.length - 1] &&
        (arg[0] === '"' || arg[0] === '\'' || arg[0] === '`')) {
        const memberName = arg.substr(1, arg.length - 2); // Assume quotes around name
        gm = message.guild.members.cache.find(m => m.displayName === memberName) ?? null;
    }
    return gm ? gm : null;
}

export function parseCachedChannel(message: Message, arg: string): GuildChannel | ThreadChannel | null {
    let ch = message.guild?.channels.cache.find(c => c.id === arg);
    if (!ch) {
        ch = message.guild?.channels.cache.find(c => c.name === arg);
    }
    if (!ch && arg.length > 2 &&
        arg[0] === arg[arg.length - 1] &&
        (arg[0] === '"' || arg[0] === '\'' || arg[0] === '`')) {
        ch = message.guild?.channels.cache.find(c => c.name === arg.substr(1, arg.length - 2));
    }
    return ch ? ch : null;
}

export async function giveCaseWarning(message: Message, symbol: string): Promise<void> {
    await message.reply(`did you mean "${symbol}"? Commands are cASe-SeNsiTIvE.`);
}

export function getCachedMember(guild: Guild, user: string | User): GuildMember | null {
    const id = user instanceof User ? user.id : user;
    return guild.members.cache.get(id) ?? null;
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