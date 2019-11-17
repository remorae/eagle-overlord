import { MessageReaction, GuildMember } from 'discord.js';
import { ClientSettings } from './settings';
import { ErrorFunc } from './error';

export function handleReaction(reaction: MessageReaction,
    member: GuildMember, added: boolean, settings: ClientSettings,
    reportError: ErrorFunc): void {
    const roleIDToToggle = roleIDFromReaction(reaction, settings);

    if (!roleIDToToggle) {
        return;
    }

    const memberRole = member.roles.get(roleIDToToggle);

    if (added && !memberRole) {
        const guildRole = member.guild.roles.find(r => r.id === roleIDToToggle);
        if (guildRole) {
            member.addRole(guildRole)
                .catch(reportError);
        } else {
            reportError(`Role id not found for reaction: ${roleIDToToggle}, ${reaction}`);
        }
    } else if (memberRole) {
        member.removeRole(memberRole)
            .catch(reportError);
    }
}

function roleIDFromReaction(reaction: MessageReaction,
    settings: ClientSettings): string | null {
    const server = settings.servers.find(s => s.id == reaction.message.guild.id);
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