import { SlashCommandBuilder } from '@discordjs/builders';
import { ApplicationCommandPermissionData, Channel, CommandInteraction, Guild, GuildMember, Permissions, Role, User } from 'discord.js';
import { ClientInstance } from '../../client';
import { Command, commandRolePermission, rolesWithPermissions } from '../command';

class GetIdCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('get_id')
            .setDescription('Get the dev ID for the given role, user, or channel.')
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
            );
    }
    async getPermissions(guild: Guild, permissions: ApplicationCommandPermissionData[]): Promise<void> {
        for (const role of rolesWithPermissions(guild, [Permissions.FLAGS.MANAGE_CHANNELS, Permissions.FLAGS.MANAGE_ROLES])) {
            permissions.push(commandRolePermission(role.id, true));
        }
    }
    async execute(interaction: CommandInteraction, _client: ClientInstance): Promise<void> {
        if (!(interaction.member instanceof GuildMember) || !interaction.guild) {
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

async function getRoleId(interaction: CommandInteraction) {
    const role = interaction.options.getRole('role');
    if (!(role instanceof Role)) {
        await interaction.reply({ content: 'Invalid role.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: role.id, ephemeral: true });
}

async function getUserId(interaction: CommandInteraction) {
    const user = interaction.options.getUser('user');
    if (!(user instanceof User)) {
        await interaction.reply({ content: 'Invalid user.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: user.id, ephemeral: true });
}

async function getChannelId(interaction: CommandInteraction) {
    const channel = interaction.options.getChannel('channel');
    if (!(channel instanceof Channel)) {
        await interaction.reply({ content: 'Invalid channel.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: channel.id, ephemeral: true });
}
