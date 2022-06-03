import { Message } from "discord.js";
import { ClientSettings } from "./settings";

export function handleCSC(message: Message, args: string[], settings: ClientSettings): void {
    if (args.length < 1) {
        message.channel.send(`Missing parameter. Use \`!help csc\` for more info.`);
        return;
    }

    const server = message.guild ? settings.servers.find(s => s.id == message.guild.id) : null;
    const member = message.guild.member(message.author);
    const role = message.guild.roles.get(server.cscRole);
    switch (args[0].toLowerCase()) {
        case `info`:
            const cscGeneralChannel = message.guild.channels.get(server.cscGeneralChannel);
            message.channel.send(`CSC stands for Cyber Security Club. See ${cscGeneralChannel} for more info.`);
            return;
        case `join`:
            if (role != null && member.roles.get(role.id) == null) {
                member.addRole(role);
                member.send(`Welcome to the CSC!`);
            }
            break;
        case `leave`:
            if (role != null && member.roles.get(role.id) != null) {
                member.removeRole(role);
                member.send(`The CSC will miss you.`);
            }
            break;
    }
}