import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { getCommandsOnDisk } from './client/command.js';
import config from './config.js';

async function main() {
    const commands = (await getCommandsOnDisk()).map(async (command) => {
        const builder = new SlashCommandBuilder();
        await command.build(builder);
        return builder.toJSON();
    });

    try {
        const rest = new REST({ version: '9' }).setToken(config.client.token);
        const route = Routes.applicationGuildCommands(config.client.id, config.client.devGuildId);
        //const route = Routes.applicationCommands(config.client.id);
        await rest.put(route, { body: commands });
        console.log(`Successfully registered ${commands.length} application commands.`);
    }
    catch (e) {
        console.error(e);
    }
}

if (require.main === module) {
    main();
}