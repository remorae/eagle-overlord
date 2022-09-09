import type { SlashCommandBuilder } from 'discord.js';
import { ChatInputCommandInteraction, PermissionsBitField, Role, User } from 'discord.js';
import type { ClientInstance } from '../../client/client.js';
import type { Command } from '../command.js';

class GetIdCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('get_id')
            .setDescription('Get the dev ID for the given role, user, or channel.')
            .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels | PermissionsBitField.Flags.ManageRoles)
            .setDMPermission(true)
            .addSubcommand(command =>
                command
                    .setName('role')
                    .setDescription('Get the dev ID for the given role.')
                    .addRoleOption(option =>
                        option
                            .setName('role')
                            .setDescription('The role to get the ID of.')
                            .setRequired(true)
                    )
            )
            .addSubcommand(command =>
                command
                    .setName('user')
                    .setDescription('Get the dev ID for the given user.')
                    .addUserOption(option =>
                        option
                            .setName('user')
                            .setDescription('The user to get the ID of.')
                            .setRequired(true)
                    )
            )
            .addSubcommand(command =>
                command
                    .setName('channel')
                    .setDescription('Get the dev ID for the given channel.')
                    .addChannelOption(option =>
                        option
                            .setName('channel')
                            .setDescription('The channel to get the ID of.')
                            .setRequired(true)
                    )
            )
    }
    async execute(interaction: ChatInputCommandInteraction, _client: ClientInstance): Promise<void> {
        if (!interaction.inCachedGuild()) {
            await interaction.reply({ content: 'You must be in a guild to use this command.', ephemeral: true });
            return;
        }
        const subCommand = interaction.options.getSubcommand();
        switch (subCommand) {
            case 'role':
                await getRoleId(interaction);
                break;
            case 'user':
                await getUserId(interaction);
                break;
            case 'channel':
                await getChannelId(interaction);
                break;
            default:
                await interaction.reply({ content: 'Invalid subcommand group.', ephemeral: true });
                break;
        }
    }
}

export const command: Command = new GetIdCommand();

async function getRoleId(interaction: ChatInputCommandInteraction) {
    const role = interaction.options.getRole('role');
    if (!(role instanceof Role)) {
        await interaction.reply({ content: 'Invalid role.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: role.id, ephemeral: true });
}

async function getUserId(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user');
    if (!(user instanceof User)) {
        await interaction.reply({ content: 'Invalid user.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: user.id, ephemeral: true });
}

async function getChannelId(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel('channel');
    if (!channel) {
        await interaction.reply({ content: 'Invalid channel.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: channel.id, ephemeral: true });
}
