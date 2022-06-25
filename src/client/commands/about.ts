import { SlashCommandBuilder } from '@discordjs/builders';
import { Guild, ApplicationCommandPermissionData, CommandInteraction } from 'discord.js';
import { Command } from '../command';
import * as path from 'path';
import { ClientInstance } from '../../client';

class AboutCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('about')
            .setDescription('Displays information about, well, me.');
    }
    async getPermissions(_guild: Guild, _permissions: ApplicationCommandPermissionData[]): Promise<void> {
    }
    async execute(interaction: CommandInteraction, _client: ClientInstance): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const config = require(path.resolve(require.main!.filename, '..', 'config.json'));
        const infoFile = require(path.resolve(require.main!.filename, '..', '..', 'package.json'));
        await interaction.reply({ content: `Currently running on version ${infoFile.version}. Created in ${config.client.deployYear} by ${config.client.developerUserName}.`, allowedMentions: { users: [] } });
    }
}

export const command: Command = new AboutCommand();