import type { SlashCommandBuilder } from '@discordjs/builders';
import type { CommandInteraction, Guild } from 'discord.js';
import type { ClientInstance } from '../../client/client.js';
import { findServer, findServerRole } from '../../client/settings.js';
import type { Command } from '../command.js';
import { addRoleToOther, addRoleToSelf, removeRoleFromOther, removeRoleFromSelf } from './role.js';

class AcmCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('acm')
            .setDescription('Manage or display ACM information.')
            .setDefaultMemberPermissions('0')
            .setDMPermission(false)
            .addSubcommand(command =>
                command
                    .setName('join')
                    .setDescription('Join ACM or add the specified user.')
                    .addUserOption(option =>
                        option
                            .setName('member')
                            .setDescription('The user to add to ACM.')
                    )
            )
            .addSubcommand(command =>
                command
                    .setName('leave')
                    .setDescription('Leave ACM or remove the specified user.')
                    .addUserOption(option =>
                        option
                            .setName('member')
                            .setDescription('The user to remove from ACM.')
                    )
            )
            .addSubcommand(command =>
                command
                    .setName('info')
                    .setDescription('Get information about ACM.')
            )
    }
    async execute(interaction: CommandInteraction, _client: ClientInstance): Promise<void> {
        if (!interaction.inCachedGuild()) {
            await interaction.reply({ content: 'You must be in a guild to use this command.', ephemeral: true });
            return;
        }
        const subCommand = interaction.options.getSubcommand();
        switch (subCommand) {
            case 'join':
                await joinAcm(interaction);
                break;
            case 'leave':
                await leaveAcm(interaction);
                break;
            case 'info':
                await sendAcmInfo(interaction);
                break;
            default:
                await interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
                break;
        }
    }
}

export const command: Command = new AcmCommand();

async function sendAcmInfo(interaction: CommandInteraction & { guild: Guild }) {
    try {
        const server = findServer(interaction.guild);
        const acmGeneralChannel = server?.channels.find((channel) => channel.name === "acmGeneral");
        await interaction.reply(`ACM stands for Association for Computing Machinery.${acmGeneralChannel ? `See ${acmGeneralChannel} for more info.` : ''}`);
    }
    catch (err) {
        await interaction.reply('Failed to find the ACM general channel.');
    }
}

async function leaveAcm(interaction: CommandInteraction & { guild: Guild; }): Promise<void> {
    const acmMemberRole = await findAcmMemberRole(interaction.guild);
    if (acmMemberRole) {
        if (interaction.options.getMember('member')) {
            await removeRoleFromOther(interaction, acmMemberRole);
        }
        else {
            await removeRoleFromSelf(interaction, acmMemberRole);
        }
    }
    else {
        await interaction.reply('Failed to find the ACM Member role.');
    }
}

async function findAcmMemberRole(guild: Guild) {
    return await findServerRole(guild, "acmMember");
}

async function joinAcm(interaction: CommandInteraction & { guild: Guild; }): Promise<void> {
    const acmMemberRole = await findAcmMemberRole(interaction.guild);
    if (acmMemberRole) {
        if (interaction.options.getMember('member')) {
            await addRoleToOther(interaction, acmMemberRole);
        }
        else {
            await addRoleToSelf(interaction, acmMemberRole);
        }
    }
    else {
        await interaction.reply('Failed to find the ACM Member role.');
    }
}
