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
        return message.guild.members.array();
    }
    let gm = message.guild.members.find(m => m.user.id === arg);
    if (gm == null) {
        gm = message.guild.members.find(m => m.user.username === arg);
    }
    if (gm == null && arg.length > 2 &&
        arg[0] == arg[arg.length - 1] &&
        (arg[0] === `"` || arg[0] === `'` || arg[0] === '`')) {
        const memberName = arg.substr(1, arg.length - 2); // Assume quotes around name
        gm = message.guild.members.find(m => m.displayName === memberName);
    }
    return gm;
}

export function parseRole(guild: Guild, arg: string): Role | null {
    let role = guild.roles.find(r => r.id === arg);
    if (role == null) {
        role = guild.roles.find(r => r.name === arg);
    }
    if (role == null && arg.length > 2 &&
        arg[0] === arg[arg.length - 1] &&
        (arg[0] === `"` || arg[0] === `'` || arg[0] === '`')) {
        role = guild.roles.find(r => r.name === arg.substr(1, arg.length - 2));
    }
    return role;
}

export function parseChannel(message: Message, arg: string): GuildChannel | null {
    let ch = message.guild.channels.find(c => c.id === arg);
    if (ch == null) {
        ch = message.guild.channels.find(c => c.name === arg);
    }
    if (ch == null && arg.length > 2 &&
        arg[0] === arg[arg.length - 1] &&
        (arg[0] === `"` || arg[0] === `'` || arg[0] === '`')) {
        ch = message.guild.channels.find(c => c.name === arg.substr(1, arg.length - 2));
    }
    return ch;
}

export function giveCaseWarning(message: Message, symbol: string): void {
    message.reply(`did you mean "${symbol}"? Commands are cASe-SeNsiTIvE.`);
}

export function ignoreUnused(_val: any) { }