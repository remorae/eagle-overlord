import { Message } from 'discord.js';
import { getCachedRole, hasRole } from './roles';
import { findServer } from './settings';
import { getAuthorMember, getCachedChannel } from './utils';

export function handleCSC(message: Message, args: string[]): void {
    if (args.length < 1) {
        message.channel.send(`Missing parameter. Use \`!help csc\` for more info.`);
        return;
    }

    const server = findServer(message.guild);
    if (!server) {
        message.channel.send(`This command requires a guild.`);
        return;
    }
    const author = getAuthorMember(message);
    const role = getCachedRole(message.guild!, server.cscRole);
    switch (args[0].toLowerCase()) {
        case `info`:
            {
                const cscGeneralChannel = getCachedChannel(message.guild!, server.cscGeneralChannel);
                message.channel.send(`CSC stands for Cyber Security Club. See ${cscGeneralChannel} for more info.`);
            }
            return;
        case `join`:
            if (role && author && !hasRole(author, role)) {
                author.roles.add(role);
                author.send(`Welcome to the CSC!`);
            }
            break;
        case `leave`:
            if (role && author && hasRole(author, role)) {
                author?.roles.add(role);
                author?.send(`The CSC will miss you.`);
            }
            break;
    }
}