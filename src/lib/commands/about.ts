import type { SlashCommandBuilder } from '@discordjs/builders';
import type { CommandInteraction } from 'discord.js';
import type { ClientInstance } from '../../client/client.js';
import config from '../../config.js';
import packageJson from '../../../package.json';
import type { Command } from '../command.js';

class AboutCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('about')
            .setDescription('Displays information about, well, me.');
    }
    async execute(interaction: CommandInteraction, _client: ClientInstance): Promise<void> {
        if (config && packageJson) {
            await interaction.reply({ content: `Currently running on version ${packageJson.version}. Created in ${config.client.deployYear} by ${config.client.developerUserName}.`, allowedMentions: { users: [] } });
        }
        else if (config) {
            await interaction.reply({ content: 'Failed to load config file.' });
        }
        else {
            await interaction.reply({ content: 'Failed to load info file.' });
        }
    }
}

export const command: Command = new AboutCommand();