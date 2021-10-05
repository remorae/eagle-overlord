import { GuildMember, Message } from 'discord.js';
import { getCachedRole, hasRole } from './roles';
import { findServer } from './settings';
import { getAuthorMember, getCachedChannel, parseCachedUser } from './utils';

export function handleACM(message: Message, args: string[]): void {
    if (args.length < 1) {
        message.channel.send(`Missing parameter. Use \`!help acm\` for more info.`);
        return;
    }

    const server = findServer(message.guild);
    if (!server) {
        message.channel.send(`This command requires a guild.`);
        return;
    }
    const author = getAuthorMember(message);
    if (!author) {
        return;
    }
    const getMember = () => {
        if (args.length > 1 && args[1]) {
            const leaderRole = getCachedRole(message.guild!, server.acmLeaderRole);
            const canAddToOther = author.permissions.has('MANAGE_ROLES') || (leaderRole && hasRole(author, leaderRole));
            return message.guild!.members.fetch()
            .then(() => {
                const targetMember = parseCachedUser(message, args[1]);
                if (canAddToOther && targetMember instanceof GuildMember) {
                    return targetMember;
                }
                if (targetMember instanceof GuildMember && targetMember.id == author.id) {
                    return author;
                }
                if (canAddToOther) {
                    message.channel.send(`Invalid user.`);
                }
                else {
                    message.channel.send(`Insufficient permissions.`);
                }
                return null;
            });
        }
        return Promise.resolve(author);
    };
    getMember().then((member) => {
        const role = getCachedRole(message.guild!, server.acmRole);
        switch (args[0].toLowerCase()) {
            case `info`:
                {
                    const acmGeneralChannel = getCachedChannel(message.guild!, server.acmGeneralChannel);
                    message.channel.send(`ACM stands for Association for Computing Machinery. See ${acmGeneralChannel} for more info.`);
                }
                return;
            case `join`:
                if (role && member && !hasRole(member, role)) {
                    member.roles.add(role);
                    if (member == author) {
                        member.send(`Welcome to ACM!`);
                    }
                }
                break;
            case `leave`:
                if (role && member && hasRole(member, role)) {
                    member.roles.remove(role);
                    if (member == author) {
                        member.send(`ACM will miss you.`);
                    }
                }
                break;
        }
    });
}