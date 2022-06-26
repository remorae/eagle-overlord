import type { SlashCommandBuilder } from '@discordjs/builders';
import { ApplicationCommandPermissionData, CommandInteraction, Guild, GuildMember, Permissions, TextChannel } from 'discord.js';
import { Command, commandRolePermission, rolesWithPermissions } from '../command.js';
import { getCachedChannel } from '../../utils.js';
import type { ErrorFunc } from '../../error.js';
import type { ClientInstance } from '../../client.js';
import { findServer } from '../../settings.js';

class WelcomeCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('welcome')
            .setDescription('Simulates a welcome event for the given user.')
            .setDefaultPermission(false)
            .addUserOption((option) =>
                option
                    .setName('user')
                    .setDescription('The user to welcome.')
                    .setRequired(true)
            );
    }
    async getPermissions(guild: Guild, permissions: ApplicationCommandPermissionData[]) {
        for (const role of rolesWithPermissions(guild, Permissions.FLAGS.MANAGE_CHANNELS)) {
            permissions.push(commandRolePermission(role.id, true));
        }
    }
    async execute(interaction: CommandInteraction, client: ClientInstance) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'You must be in a guild to use this command.', ephemeral: true });
            return;
        }
        const member = interaction.options.getMember('user', true);
        if (!(member instanceof GuildMember)) {
            await interaction.reply({ content: 'Invalid user.', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            const success = await welcome(member, async (msg) => await client.reportError(msg, 'WelcomeCommand.execute'));
            if (success) {
                await interaction.editReply({ content: 'Done!' });
            }
            else {
                await interaction.editReply({ content: 'Failed to welcome user. Welcome/general channels may not be configured.' });
            }
        }
        catch (err) {
            await interaction.editReply({ content: 'Something went wrong!' });
            throw err;
        }
    }
}

export const command: Command = new WelcomeCommand();

export async function welcome(member: GuildMember, reportError: ErrorFunc): Promise<boolean> {
    const server = findServer(member.guild);
    if (!server) {
        return false;
    }
    const welcomeChannel = getCachedChannel(member.guild, server.welcomeChannel) as TextChannel;
    const generalChannel = getCachedChannel(member.guild, server.generalChannel) as TextChannel;
    if (!welcomeChannel || !generalChannel) {
        return false;
    }

    await generalChannel.send(`${member.user} has logged on!` +
        `\nPlease take a look at ${welcomeChannel} before you get started.`);

    await member.guild.roles.fetch();
    for (const defaultRole of server.defaultRoles) {
        const role = member.guild.roles.cache.get(defaultRole);
        if (!role) {
            continue;
        }
        await member.roles.add(role).catch(reportError);
    }
    return true;
}