import { Client } from 'discord.js';
import { ClientInstance } from './client';
import { Terminal } from './terminal';
import { ClientSettings } from './settings';

function main(): void {
    const settings: ClientSettings = require("../settings/settings.json");
    const client = new Client();
    const instance = new ClientInstance(client, settings);
    const terminal = new Terminal(instance);

    let delay = false;
    while (true) {
        if (delay) {
            continue;
        }
        try {
            instance.client.login(settings.token);
            break;
        } catch (err) {
            console.error(err);
            setTimeout(function () {
                delay = false;
            }, 1000);
            delay = true;
        }
    }
}

if (require.main === module) {
    main();
}