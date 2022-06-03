import { GuildMember, TextChannel } from 'discord.js';
import { getCachedChannel } from './utils';
import { ErrorFunc } from './error';
import { findServer } from './settings';

export async function welcome(member: GuildMember, reportError: ErrorFunc): Promise<void> {
    const server = findServer(member.guild);
    if (!server) {
        return;
    }
    const welcomeChannel = getCachedChannel(member.guild, server.welcomeChannel) as TextChannel;
    const generalChannel = getCachedChannel(member.guild, server.generalChannel) as TextChannel;
    if (!welcomeChannel || !generalChannel) {
        return;
    }

    generalChannel.send(`${member.user} has logged on!` +
        `\nPlease take a look at ${welcomeChannel} before you get started.`);

    await member.guild.roles.fetch();
    for (const defaultRole of server.defaultRoles) {
        const role = member.guild.roles.cache.get(defaultRole);
        if (!role) {
            continue;
        }
        await member.roles.add(role).catch(reportError);
    }
}