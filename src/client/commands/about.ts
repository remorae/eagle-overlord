import type { SlashCommandBuilder } from '@discordjs/builders';
import type { Guild, ApplicationCommandPermissionData, CommandInteraction } from 'discord.js';
import type { ClientInstance } from '../../client.js';
import config from '../../config.js';
import { loadRelativeToMain } from '../../utils.js';
import type { Command } from '../command.js';

class AboutCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('about')
            .setDescription('Displays information about, well, me.');
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async getPermissions(_guild: Guild, _permissions: ApplicationCommandPermissionData[]): Promise<void> {
    }
    async execute(interaction: CommandInteraction, _client: ClientInstance): Promise<void> {
        const infoFile = loadRelativeToMain('../../package.json', false);
        if (config && infoFile) {
            await interaction.reply({ content: `Currently running on version ${infoFile.version}. Created in ${config.client.deployYear} by ${config.client.developerUserName}.`, allowedMentions: { users: [] } });
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