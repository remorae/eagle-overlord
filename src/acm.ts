import { Message } from 'discord.js';
import { ClientSettings } from './settings';

export function handleACM(message: Message, args: string[],
    settings: ClientSettings): void {
    if (args.length < 1) {
        message.channel.send(`Missing parameter. Use \`!help acm\` for more info.`);
        return;
    }

    const server = message.guild
        ? settings.servers.find((s) => s.id == message.guild.id)
        : null;
    if (!server) {
        return;
    }
    const member = message.guild.member(message.author);
    const role = message.guild.roles.get(server.acmRole);
    switch (args[0].toLowerCase()) {
        case `info`:
            const acmGeneralChannel = message.guild.channels
                .get(server.acmGeneralChannel);
            message.channel.send(`ACM stands for Association for Computing Machinery. See ${acmGeneralChannel} for more info.`);
            return;
        case `join`:
            if (role && !member.roles.get(role.id)) {
                member.addRole(role);
                member.send(`Welcome to ACM!`);
            }
            break;
        case `leave`:
            if (role && member.roles.get(role.id)) {
                member.removeRole(role);
                member.send(`ACM will miss you.`);
            }
            break;
    }
}