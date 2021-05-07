import { parseRole } from './utils';
import { Message, TextChannel, GuildMember, Role } from 'discord.js';
import { ClientSettings } from './settings';
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

function removeRole(channel: TextChannel, member: GuildMember, role: Role, allowPings: boolean, reportError: ErrorFunc): void {
    if (member.roles.cache.some((toFind: Role) => toFind.id === role.id)) {
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

export function changeRolesForMember(member: GuildMember | GuildMember[], message: Message, args: string[], adding: boolean, isForOther: boolean, checkPrefix: boolean, allowPings: boolean,
    reportError: ErrorFunc, settings: ClientSettings): void {
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
    const server = settings.servers.find(s => s.id == message.guild?.id);
    if (!server) {
        return;
    }

    for (let i = (isForOther) ? 1 : 0; i < args.length; ++i) {
        const roleName = args[i];
        if (!roleName) {
            continue;
        }
        if (checkPrefix && !isValidPrefix(roleName, server.validClassPrefixes)) {
            message.channel.send(`"${roleName}" does not have a valid prefix.`);
            continue;
        }

        const role = parseRole(message.guild!, roleName);
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
        }

        if (member instanceof Array) {
            // Changing roles for multiple members
            member.forEach(guildMember => addOrRemove(guildMember));
        } else {
            addOrRemove(member);
        }
    }
}

export function processAddRole(message: Message, args: string[], settings: ClientSettings, reportError: ErrorFunc): void {
    if (!(message.channel instanceof TextChannel)) {
        message.channel.send(`Command requires a guild.`);
        return;
    }
    if (args.length != 1) {
        message.channel.send(`Invalid number of arguments.`);
        return;
    }

    const member = message.guild?.member(message.author);
    let role = null;
    switch (args[0]) {
        case `csc-pnnl`:
            const server = message.guild
                ? settings.servers.find(s => s.id == message.guild?.id)
                : null;
            if (!server) {
                return;
            }
            role = member?.guild.roles.cache.get(server.cscCompetitionRole);
            break;
        default:
            break;
    }
    if (role) {
        addRole(message.channel as TextChannel, member!, role, true, reportError);
    } else {
        message.channel.send(`Invalid role.`);
    }
}