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

function addRole(channel: TextChannel, member: GuildMember, role: Role, allowPings: boolean, reportError: ErrorFunc): void {
    if (!member.roles.cache.some((toFind: Role) => toFind.id === role.id)) {
        member.roles.add(role)
            .then((member: GuildMember) => {
                if (allowPings) {
                    channel.send(`Added role "${role.name}" to ${member.user}.`);
                }
            })
            .catch(reportError);
    } else if (allowPings) {
        channel.send(`User ${member.user} already has role "${role.name}".`);
    }
}

export function hasRole(member: GuildMember, role: Role): boolean {
    return member.roles.cache.some((toFind: Role) => toFind.id === role.id);
}

function removeRole(channel: TextChannel, member: GuildMember, role: Role, allowPings: boolean, reportError: ErrorFunc): void {
    if (hasRole(member, role)) {
        member.roles.remove(role)
            .then((member: GuildMember) => {
                if (allowPings) {
                    channel.send(`Removed role "${role.name}" from ${member.user}.`);
                }
            })
            .catch(reportError);
    } else if (allowPings) {
        channel.send(`User ${member.user} does not have role "${role.name}".`);
    }
}

export function changeRolesForMember(member: GuildMember | Iterable<GuildMember>, message: Message, args: string[], adding: boolean, isForOther: boolean, checkPrefix: boolean, allowPings: boolean,
    reportError: ErrorFunc): void {
    if (!(message.channel instanceof TextChannel)) {
        return;
    }
    if (!member) {
        message.channel.send(`Invalid guildMember.`);
        return;
    }
    if (args.length < 1) {
        message.channel.send(`You must enter a role.`);
        return;
    }
    const server = findServer(message.guild);
    if (!server) {
        return;
    }

    message.guild?.roles.fetch().then(() => {
        for (let i = (isForOther) ? 1 : 0; i < args.length; ++i) {
            const roleName = args[i];
            if (!roleName) {
                continue;
            }
            if (checkPrefix && !isValidPrefix(roleName, server.validClassPrefixes)) {
                message.channel.send(`"${roleName}" does not have a valid prefix.`);
                continue;
            }

            const role = parseCachedRole(message.guild!, roleName);
            if (!role) {
                message.channel.send(`"${roleName}" is not a valid role.`);
                continue;
            }

            const addOrRemove = (member: GuildMember) => {
                if (adding) {
                    addRole(message.channel as TextChannel, member, role, allowPings, reportError);
                } else {
                    removeRole(message.channel as TextChannel, member, role, allowPings, reportError);
                }
            };

            if (member instanceof GuildMember) {
                addOrRemove(member);
            }
            else {
                // Changing roles for multiple members
                for (const guildMember of member) {
                    addOrRemove(guildMember);
                }
            }
        }
    });
}

export function processAddRole(message: Message, args: string[], reportError: ErrorFunc): void {
    if (!(message.channel instanceof TextChannel)) {
        message.channel.send(`Command requires a guild.`);
        return;
    }
    if (args.length != 1) {
        message.channel.send(`Invalid number of arguments.`);
        return;
    }

    const member = getAuthorMember(message);
    const getRole = () => {
        switch (args[0]) {
            case `csc-pnnl`:
                {
                    const server = findServer(message.guild);
                    if (server) {
                        return Promise.resolve(getCachedRole(member!.guild, server.cscCompetitionRole));
                    }
                }
                break;
            default:
                break;
        }
        return Promise.resolve(null);
    };
    getRole().then((role) => {
        if (role) {
            addRole(message.channel as TextChannel, member!, role, true, reportError);
        } else {
            message.channel.send(`Invalid role.`);
        }
    });
}

export function getCachedRole(guild: Guild, role: string): Role | null {
    return guild.roles.cache.get(role) ?? null;
}