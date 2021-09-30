import { Message, Guild, GuildMember, Role, GuildChannel, ThreadChannel, User } from 'discord.js';
import { getCachedRole } from './roles';

export function parseCachedUser(message: Message, arg: string): GuildMember | Iterable<GuildMember> | null {
    if (message.guild == null) {
        message.channel.send(`This command requires a guild.`);
        return null;
    }
    if (arg == null) {
        message.channel.send(`You must enter a user.`);
        return null;
    }
    if (arg === `all`) {
        return message.guild.members.cache.values();
    }
    let gm = getCachedMember(message.guild, arg);
    if (!gm) {
        gm = message.guild.members.cache.find(m => m.user.username === arg) ?? null;
    }
    if (!gm && arg.length > 2 &&
        arg[0] == arg[arg.length - 1] &&
        (arg[0] === `"` || arg[0] === `'` || arg[0] === '`')) {
        const memberName = arg.substr(1, arg.length - 2); // Assume quotes around name
        gm = message.guild.members.cache.find(m => m.displayName === memberName) ?? null;
    }
    return gm ? gm : null;
}

export function parseCachedRole(guild: Guild, arg: string): Role | null {
    let role = getCachedRole(guild, arg);
    if (!role) {
        role = guild.roles.cache.find(r => r.name === arg) ?? null;
    }
    if (!role && arg.length > 2 &&
        arg[0] === arg[arg.length - 1] &&
        (arg[0] === `"` || arg[0] === `'` || arg[0] === '`')) {
        role = guild.roles.cache.find(r => r.name === arg.substr(1, arg.length - 2)) ?? null;
    }
    return role ? role : null;
}

export function parseCachedChannel(message: Message, arg: string): GuildChannel | ThreadChannel | null {
    let ch = message.guild?.channels.cache.find(c => c.id === arg);
    if (!ch) {
        ch = message.guild?.channels.cache.find(c => c.name === arg);
    }
    if (!ch && arg.length > 2 &&
        arg[0] === arg[arg.length - 1] &&
        (arg[0] === `"` || arg[0] === `'` || arg[0] === '`')) {
        ch = message.guild?.channels.cache.find(c => c.name === arg.substr(1, arg.length - 2));
    }
    return ch ? ch : null;
}

export function giveCaseWarning(message: Message, symbol: string): void {
    message.reply(`did you mean "${symbol}"? Commands are cASe-SeNsiTIvE.`);
}

export function ignoreUnused(_val: any) { }

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