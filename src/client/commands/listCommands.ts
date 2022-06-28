import type { SlashCommandBuilder } from '@discordjs/builders';
import { Guild, ApplicationCommandPermissionData, CommandInteraction, GuildMember, ApplicationCommand, GuildResolvable, Collection } from 'discord.js';
import type { ClientInstance } from '../../client.js';
import type { Command } from '../command.js';

class ListCommandsCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('commands')
            .setDescription('Lists all available commands that I recognize. Usage is case-sensitive.');
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async getPermissions(_guild: Guild, _permissions: ApplicationCommandPermissionData[]): Promise<void> {
    }
    async execute(interaction: CommandInteraction, _client: ClientInstance): Promise<void> {
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
    const { guild, member } = interaction;
    if (guild && member instanceof GuildMember) {
        const commandPermissions = commands
            .map(async (cmd, _id) => {
                return { cmd, allowed: hasRoleOrMemberPermission(cmd, guild, member) };
            });
        const resolvedPermissions = await Promise.all(commandPermissions);
        const availableNames = resolvedPermissions
            .filter(({ allowed }) => allowed)
            .map(({ cmd }) => cmd.name)
            .sort();
        const msg = `Current commands: ${availableNames.join(', ')}`;
        await interaction.reply({ content: msg, ephemeral: true });
    }
    else {
        await interaction.reply({ content: 'No available commands.', ephemeral: true });
    }
}

async function hasRoleOrMemberPermission(cmd: ApplicationCommand<{ guild?: GuildResolvable }>, guild: Guild, member: GuildMember) {
    if (await cmd.permissions.has({ guild, permissionId: member })) {
        return true;
    }
    const rolePermissions = member.roles.cache
        .map(async (role) => cmd.permissions.has({ guild, permissionId: role }));
    return Promise.any(rolePermissions);
}