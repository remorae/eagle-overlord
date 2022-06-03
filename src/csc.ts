import { Message } from 'discord.js';
import { getCachedRole, hasRole } from './roles';
import { findServer } from './settings';
import { getAuthorMember, getCachedChannel } from './utils';

export async function handleCSC(message: Message, args: string[]): Promise<void> {
    if (args.length < 1) {
        await message.channel.send(`Missing parameter. Use \`!help csc\` for more info.`);
        return;
    }

    const server = findServer(message.guild);
    if (!server) {
        await message.channel.send(`This command requires a guild.`);
        return;
    }
    const author = getAuthorMember(message);
    const role = getCachedRole(message.guild!, server.cscRole);
    switch (args[0].toLowerCase()) {
        case `info`:
            {
                const cscGeneralChannel = getCachedChannel(message.guild!, server.cscGeneralChannel);
                await message.channel.send(`CSC stands for Cyber Security Club. See ${cscGeneralChannel} for more info.`);
            }
            return;
        case `join`:
            if (role && author && !hasRole(author, role)) {
                await author.roles.add(role);
                await author.send(`Welcome to the CSC!`);
            }
            break;
        case `leave`:
            if (role && author && hasRole(author, role)) {
                await author?.roles.remove(role);
                await author?.send(`The CSC will miss you.`);
            }
            break;
    }
}