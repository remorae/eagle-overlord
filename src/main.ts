import { Client, IntentsBitField, Partials } from 'discord.js';
import { ClientInstance } from './client/client.js';
import { Terminal } from './client/terminal.js';
import config from './config.js';

async function main() {
    const client = new Client({
        intents: [
            IntentsBitField.Flags.Guilds,
            IntentsBitField.Flags.GuildMembers, // For guildMemberAdd
            IntentsBitField.Flags.GuildMessages, // For messageCreate, etc.
            IntentsBitField.Flags.GuildMessageReactions, // For messageReactionAdd, etc.
            IntentsBitField.Flags.DirectMessages // For messageCreate, etc.
        ],
        partials: [
            Partials.Channel // Necessary to cache DM Channels in order to receive DMs
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