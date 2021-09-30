import { GuildMember, TextChannel } from 'discord.js';
import { ClientSettings } from './settings';
import { getCachedChannel, parseCachedRole } from './utils';
import { ErrorFunc } from './error';

export function welcome(member: GuildMember, settings: ClientSettings, reportError: ErrorFunc): void {
    const server = settings.servers.find(s => s.id == member.guild.id);
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

    member.guild.roles.fetch().then(() => {
        for (const defaultRole of server.defaultRoles) {
            const role = parseCachedRole(member.guild, defaultRole);
            if (!role) {
                continue;
            }
            member.roles.add(role)
                .catch(reportError);
        }
    });
}