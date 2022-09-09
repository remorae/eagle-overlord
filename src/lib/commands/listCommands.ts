import type { SlashCommandBuilder } from 'discord.js';
import type { Guild, CommandInteraction, GuildMember, ApplicationCommand, GuildResolvable, Collection } from 'discord.js';
import type { ClientInstance } from '../../client/client.js';
import type { Command } from '../command.js';

class ListCommandsCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('commands')
            .setDescription('Lists all available commands that I recognize. Usage is case-sensitive.')
            .setDMPermission(true)
    }
    async execute(interaction: CommandInteraction, _client: ClientInstance): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        try {
            let commands = await interaction.client.application?.commands.fetch();
            if (interaction.guild) {
                const guildCommands = await interaction.guild.commands.fetch();
                commands = (commands) ? commands.concat(guildCommands) : guildCommands;
            }
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
    if (interaction.inCachedGuild()) {
        const commandPermissions = commands
            .map(async (cmd, _id) => {
                return { cmd, allowed: hasRoleOrMemberPermission(cmd, interaction.guild, interaction.member) };
            });
        const resolvedPermissions = await Promise.all(commandPermissions);
        const availableNames = resolvedPermissions
            .filter(({ allowed }) => allowed)
            .map(({ cmd }) => cmd.name)
            .sort();
        const msg = `Current commands: ${availableNames.join(', ')}`;
        await interaction.editReply({ content: msg });
    }
    else {
        const msg = `Current commands: ${commands.map((c) => c.name).join(', ')}`;
        await interaction.editReply({ content: msg });
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