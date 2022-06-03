import { MessageReaction, GuildMember } from 'discord.js';
import { ErrorFunc } from './error';
import { findServer } from './settings';

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
            try {
                await member.roles.add(guildRole);
            }
            catch (e) {
                await reportError(e);
            }
        } else {
            await reportError(`Role id not found for reaction: ${roleIDToToggle}, ${reaction}`);
        }
    } else if (memberRole) {
        try {
            await member.roles.remove(memberRole);
        }
        catch (e) {
            await reportError(e);
        }
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