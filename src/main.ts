import { Client, Intents } from 'discord.js';
import { ClientInstance } from './client';
import { Terminal } from './terminal';
import { ClientSettings } from './settings';
import { ignoreUnused } from './utils';

function main(): void {
    const settings: ClientSettings = require('../settings/settings.json');
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
    const instance = new ClientInstance(client, settings);
    const terminal = new Terminal(instance);
    ignoreUnused(terminal);

    instance.client.login(settings.token);
}

if (require.main === module) {
    main();
}