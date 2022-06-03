import { getAuthorMember, parseCachedRole } from './utils';
import { Message, TextChannel, GuildMember, Role, Guild } from 'discord.js';
import { findServer } from './settings';
import { ErrorFunc } from './error';

function isValidPrefix(roleName: string, validClassPrefixes: string[]): boolean {
    let result = false;
    validClassPrefixes.forEach(prefix => {
        if (roleName.toUpperCase().startsWith(prefix)) {
            result = true;
        }
    });
    return result;
}

async function addRole(channel: TextChannel, member: GuildMember, role: Role, allowPings: boolean, reportError: ErrorFunc): Promise<void> {
    if (!member.roles.cache.some((toFind: Role) => toFind.id === role.id)) {
        try {
            await member.roles.add(role);
            if (allowPings) {
                channel.send(`Added role "${role.name}" to ${member.user}.`);
            }
        }
        catch(e) {
            await reportError(e);
        }
    } else if (allowPings) {
        await channel.send(`User ${member.user} already has role "${role.name}".`);
    }
}

export function hasRole(member: GuildMember, role: Role): boolean {
    return member.roles.cache.some((toFind: Role) => toFind.id === role.id);
}

async function removeRole(channel: TextChannel, member: GuildMember, role: Role, allowPings: boolean, reportError: ErrorFunc): Promise<void> {
    if (hasRole(member, role)) {
        try {
            await member.roles.remove(role);
            if (allowPings) {
                await channel.send(`Removed role "${role.name}" from ${member.user}.`);
            }
        }
        catch(e) {
            await reportError(e);
        }
    } else if (allowPings) {
        await channel.send(`User ${member.user} does not have role "${role.name}".`);
    }
}

export async function changeRolesForMember(member: GuildMember | Iterable<GuildMember>, message: Message, args: string[], adding: boolean, isForOther: boolean, checkPrefix: boolean, allowPings: boolean,
    reportError: ErrorFunc): Promise<void> {
    if (!(message.channel instanceof TextChannel)) {
        return;
    }
    if (!member) {
        await message.channel.send(`Invalid guildMember.`);
        return;
    }
    if (args.length < 1) {
        await message.channel.send(`You must enter a role.`);
        return;
    }
    const server = findServer(message.guild);
    if (!server) {
        return;
    }

    await message.guild?.roles.fetch();
    for (let i = (isForOther) ? 1 : 0; i < args.length; ++i) {
        const roleName = args[i];
        if (!roleName) {
            continue;
        }
        if (checkPrefix && !isValidPrefix(roleName, server.validClassPrefixes)) {
            await message.channel.send(`"${roleName}" does not have a valid prefix.`);
            continue;
        }

        const role = parseCachedRole(message.guild!, roleName);
        if (!role) {
            await message.channel.send(`"${roleName}" is not a valid role.`);
            continue;
        }

        const addOrRemove = async (member: GuildMember) => {
            if (adding) {
                await addRole(message.channel as TextChannel, member, role, allowPings, reportError);
            } else {
                await removeRole(message.channel as TextChannel, member, role, allowPings, reportError);
            }
        };

        if (member instanceof GuildMember) {
            await addOrRemove(member);
        }
        else {
            // Changing roles for multiple members
            for (const guildMember of member) {
                await addOrRemove(guildMember);
            }
        }
    }
}

export async function processAddRole(message: Message, args: string[], reportError: ErrorFunc): Promise<void> {
    if (!(message.channel instanceof TextChannel)) {
        await message.channel.send(`Command requires a guild.`);
        return;
    }
    if (args.length != 1) {
        await message.channel.send(`Invalid number of arguments.`);
        return;
    }

    const member = getAuthorMember(message);
    let role: Role | null = null;
    switch (args[0]) {
        case `csc-pnnl`:
            {
                const server = findServer(message.guild);
                if (server) {
                    role = getCachedRole(member!.guild, server.cscCompetitionRole);
                }
            }
            break;
        default:
            break;
    }
    if (role) {
        await addRole(message.channel as TextChannel, member!, role, true, reportError);
    } else {
        await message.channel.send(`Invalid role.`);
    }
}

export function getCachedRole(guild: Guild, role: string): Role | null {
    return guild.roles.cache.get(role) ?? null;
}