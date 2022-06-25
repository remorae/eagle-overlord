import { SlashCommandBuilder } from '@discordjs/builders';
import { Guild, ApplicationCommandPermissionData, CommandInteraction, GuildMember, ApplicationCommand, GuildResolvable, Collection } from 'discord.js';
import { Command } from '../command';

class ListCommandsCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('commands')
            .setDescription('Lists all available commands that I recognize. Usage is case-sensitive.');
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async getPermissions(_guild: Guild, _permissions: ApplicationCommandPermissionData[]): Promise<void> {
    }
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        try {
            const commands = (interaction.guild)
                ? await interaction.guild.commands.fetch()
                : await interaction.client.application?.commands.fetch();
            if (!commands) {
                await interaction.editReply({ content: 'No commands found. Slash commands may still be deploying.' });
                return;
            }
            await sendCommandList(commands, interaction);
        }
        catch (err) {
            await interaction.editReply({ content: 'Something went wrong!' });
            throw err;
        }
    }

}

export const command: Command = new ListCommandsCommand();

async function sendCommandList(commands: Collection<string, ApplicationCommand<{ guild?: GuildResolvable; }>>, interaction: CommandInteraction): Promise<void> {
    const available = new Array<ApplicationCommand<{ guild: GuildResolvable; }>>();
    for (const [_id, command] of commands) {
        if (interaction.member && interaction.guild) {
            const guild = interaction.guild;
            if (await command.permissions.has({ guild: guild, permissionId: interaction.member as GuildMember })
                || (interaction.member as GuildMember).roles.cache.map((r) => Promise.resolve(r)).some(async (role) => {
                    return await command.permissions.has({ guild: guild, permissionId: await role });
                })) {
                available.push(command);
            }
        }
    }
    await interaction.reply({ content: `Current commands: ${available.map(c => c.name).sort().join(', ')}`, ephemeral: true });
}
