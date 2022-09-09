import type { SlashCommandBuilder } from 'discord.js';
import type { CommandInteraction } from 'discord.js';
import type { Command } from '../command';
import config from '../../config.js';

class StuCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('stu')
            .setDescription('Stu.')
            .setDMPermission(true)
    }
    async execute(interaction: CommandInteraction) {
        if (interaction.user.id === config.client.stuID) {
            await interaction.reply({ content: "ʕ •ᴥ•ʔ All aboard Stu's Happyland Express ʕ •ᴥ•ʔ", ephemeral: true });
        }
        else {
            await interaction.reply({ content: 'Stu.', ephemeral: true });
        }
    }
}
export const command: Command = new StuCommand();