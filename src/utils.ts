import { Message, Guild, GuildMember, Role, GuildChannel } from 'discord.js';

export function parseUser(message: Message, arg: string): GuildMember | GuildMember[] | null {
    if (message.guild == null) {
        message.channel.send(`This command requires a guild.`);
        return null;
    }
    if (arg == null) {
        message.channel.send(`You must enter a user.`);
        return null;
    }
    if (arg === `all`) {
        return message.guild.members.cache.array();
    }
    let gm = message.guild.members.cache.find(m => m.user.id === arg);
    if (!gm) {
        gm = message.guild.members.cache.find(m => m.user.username === arg);
    }
    if (!gm && arg.length > 2 &&
        arg[0] == arg[arg.length - 1] &&
        (arg[0] === `"` || arg[0] === `'` || arg[0] === '`')) {
        const memberName = arg.substr(1, arg.length - 2); // Assume quotes around name
        gm = message.guild.members.cache.find(m => m.displayName === memberName);
    }
    return gm ? gm : null;
}

export function parseRole(guild: Guild, arg: string): Role | null {
    let role = guild.roles.cache.find(r => r.id === arg);
    if (!role) {
        role = guild.roles.cache.find(r => r.name === arg);
    }
    if (!role && arg.length > 2 &&
        arg[0] === arg[arg.length - 1] &&
        (arg[0] === `"` || arg[0] === `'` || arg[0] === '`')) {
        role = guild.roles.cache.find(r => r.name === arg.substr(1, arg.length - 2));
    }
    return role ? role : null;
}

export function parseChannel(message: Message, arg: string): GuildChannel | null {
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