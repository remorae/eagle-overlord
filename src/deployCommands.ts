import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Command } from './client/command';
import * as fs from 'fs';
import * as config from './config.json'
import * as path from 'path';

async function main() {
    const commandsDir = path.resolve(path.dirname(require.main!.filename), 'client', 'commands');
    const commandFiles = (await fs.promises.readdir(commandsDir)).filter(file => file.endsWith('.js'));
    const commands = commandFiles.map(file => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const command = require(path.resolve(commandsDir, file)).command as Command;
        const builder = new SlashCommandBuilder();
        command.build(builder);
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