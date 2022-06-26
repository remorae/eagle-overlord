import { Client, Intents } from 'discord.js';
import { ClientInstance } from './client.js';
import { Terminal } from './terminal.js';
import config from './config.js';

async function main() {
    const client = new Client({
        intents: [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MEMBERS, // For guildMemberAdd
            Intents.FLAGS.GUILD_MESSAGES, // For messageCreate, etc.
            Intents.FLAGS.GUILD_MESSAGE_REACTIONS, // For messageReactionAdd, etc.
            Intents.FLAGS.DIRECT_MESSAGES // For messageCreate, etc.
        ],
        partials: [
            'CHANNEL' // Necessary to cache DM Channels in order to receive DMs
        ]
    });
    const instance = new ClientInstance(client);
    await instance.setupCommands();

    instance.terminal = new Terminal(instance);

    await instance.client.login(config.client.token);
}

if (require.main === module) {
    main();
}