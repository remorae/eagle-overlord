import { SlashCommandBuilder } from '@discordjs/builders';
import { ApplicationCommandPermissionData, CommandInteraction, Guild } from 'discord.js';
import { Command } from '../command';
import * as path from 'path';

class StuCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('stu')
            .setDescription('Stu.')
            .setDefaultPermission(false);
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async getPermissions(_guild: Guild, _permissions: ApplicationCommandPermissionData[]) {
    }
    async execute(interaction: CommandInteraction) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-non-null-assertion
        const config = require(path.resolve(require.main!.filename, '..', 'config.json'));
        if (interaction.user.id == config.client.stuID) {
            await interaction.reply({ content: 'ʕ •ᴥ•ʔ All aboard Stu\'s Happyland Express ʕ •ᴥ•ʔ', ephemeral: true});
        }
        else {
            await interaction.reply({ content: 'Stu.', ephemeral: true});
        }
    }
}
export const command: Command = new StuCommand();