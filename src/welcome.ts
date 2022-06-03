import { GuildMember, TextChannel } from "discord.js";
import { ClientSettings } from "./settings";
import { parseRole } from "./utils";

export function welcome(member: GuildMember, settings: ClientSettings, reportError: (message: Error | string) => void): void {
    const server = settings.servers.find(s => s.id == member.guild.id);
    if (!server) {
        return;
    }
    const welcomeChannel = member.guild.channels.get(server.welcomeChannel) as TextChannel;
    const rulesChannel = member.guild.channels.get(server.rulesChannel) as TextChannel;
    if (!welcomeChannel || !rulesChannel) {
        return;
    }

    welcomeChannel.send(`${member.user} has logged on!` +
        `\nPlease take a look at ${welcomeChannel} before you get started.`);

    for (const defaultRole of server.defaultRoles) {
        const role = parseRole(member.guild, defaultRole);
        member.addRole(role)
            .catch(reportError);
    }
}