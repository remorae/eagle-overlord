import { GuildMember, Message } from 'discord.js';
import { getCachedRole, hasRole } from './roles';
import { findServer } from './settings';
import { getAuthorMember, getCachedChannel, parseCachedUser } from './utils';

export async function handleACM(message: Message, args: string[]): Promise<void> {
    if (args.length < 1) {
        await message.channel.send(`Missing parameter. Use \`!help acm\` for more info.`);
        return;
    }

    const server = findServer(message.guild);
    if (!server) {
        await message.channel.send(`This command requires a guild.`);
        return;
    }
    const author = getAuthorMember(message);
    if (!author) {
        return;
    }
    let member: GuildMember | null = null;
    if (args.length > 1 && args[1]) {
        const leaderRole = getCachedRole(message.guild!, server.acmLeaderRole);
        const canAddToOther = author.permissions.has('MANAGE_ROLES') || (leaderRole && hasRole(author, leaderRole));
        await message.guild!.members.fetch();
        const targetMember = await parseCachedUser(message, args[1]);
        if (canAddToOther && targetMember instanceof GuildMember) {
            member = targetMember;
        }
        else if (targetMember instanceof GuildMember && targetMember.id == author.id) {
            member = author;
        }
        else if (canAddToOther) {
            await message.channel.send(`Invalid user.`);
        }
        else {
            await message.channel.send(`Insufficient permissions.`);
        }
    }
    const role = getCachedRole(message.guild!, server.acmRole);
    switch (args[0].toLowerCase()) {
        case `info`:
            {
                const acmGeneralChannel = getCachedChannel(message.guild!, server.acmGeneralChannel);
                await message.channel.send(`ACM stands for Association for Computing Machinery. See ${acmGeneralChannel} for more info.`);
            }
            return;
        case `join`:
            if (role && member && !hasRole(member, role)) {
                await member.roles.add(role);
                if (member == author) {
                    await member.send(`Welcome to ACM!`);
                }
            }
            break;
        case `leave`:
            if (role && member && hasRole(member, role)) {
                await member.roles.remove(role);
                if (member == author) {
                    await member.send(`ACM will miss you.`);
                }
            }
            break;
    }
}