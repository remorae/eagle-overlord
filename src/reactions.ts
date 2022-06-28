import type { MessageReaction, GuildMember, Role } from 'discord.js';
import type { ErrorFunc } from './error.js';
import { findServer } from './settings.js';

export async function handleReaction(reaction: MessageReaction,
    member: GuildMember, added: boolean, reportError: ErrorFunc): Promise<void> {
    const roleIDToToggle = roleIDFromReaction(reaction);

    if (!roleIDToToggle) {
        return;
    }

    const memberRole = member.roles.cache.get(roleIDToToggle);

    if (added && !memberRole) {
        const guildRole = member.guild.roles.cache.find(r => r.id === roleIDToToggle);
        if (guildRole) {
            await addRoleToMember(member, guildRole, reportError);
        } else {
            await reportError(`Role id not found for reaction: ${roleIDToToggle}, ${reaction}`);
        }
    } else if (memberRole) {
        await removeRoleFromMember(member, memberRole, reportError);
    }
}

async function removeRoleFromMember(member: GuildMember, role: Role, reportError: ErrorFunc) {
    try {
        await member.roles.remove(role);
    }
    catch (e) {
        await reportError(e);
    }
}

async function addRoleToMember(member: GuildMember, role: Role, reportError: ErrorFunc) {
    try {
        await member.roles.add(role);
    }
    catch (e) {
        await reportError(e);
    }
}

function roleIDFromReaction(reaction: MessageReaction): string | null {
    const server = findServer(reaction.message.guild);
    if (!server) {
        return null;
    }
    for (const cached of server.messagesToCache) {
        const handledReaction = cached.reactions.find(r => r.name === reaction.emoji.name);
        if (handledReaction) {
            return handledReaction.roleID;
        }
    }
    return null;
}