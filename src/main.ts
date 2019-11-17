import { Client } from 'discord.js';
import { ClientInstance } from './client';
import { Terminal } from './terminal';
import { ClientSettings } from './settings';
import { ignoreUnused } from './utils';

function main(): void {
    const settings: ClientSettings = require('../settings/settings.json');
    const client = new Client();
    const instance = new ClientInstance(client, settings);
    const terminal = new Terminal(instance);
    ignoreUnused(terminal);

    instance.client.login(settings.token);
}

if (require.main === module) {
    main();
}