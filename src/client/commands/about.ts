import { SlashCommandBuilder } from '@discordjs/builders';
import { Guild, ApplicationCommandPermissionData, CommandInteraction } from 'discord.js';
import { Command } from '../command';
import { ClientInstance } from '../../client';
import * as Config from '../../config.json';
import { loadRelativeToMain } from '../../utils';

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
        const config = loadRelativeToMain('../config.json') as typeof Config | null;
        const infoFile = loadRelativeToMain('../../package.json');
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