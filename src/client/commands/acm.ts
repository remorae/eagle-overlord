import { SlashCommandBuilder } from '@discordjs/builders';
import { Guild, ApplicationCommandPermissionData, CommandInteraction, GuildMember } from 'discord.js';
import { ClientInstance } from '../../client';
import { Command } from '../command';
import { addRoleToOther, addRoleToSelf, removeRoleFromOther, removeRoleFromSelf } from './role';

class AcmCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('acm')
            .setDescription('Manage or display ACM information.')
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
            );
    }
    async getPermissions(_guild: Guild, _permissions: ApplicationCommandPermissionData[]): Promise<void> {
    }
    async execute(interaction: CommandInteraction, _client: ClientInstance): Promise<void> {
        if (!(interaction.member instanceof GuildMember) || !interaction.guild) {
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

export const acmMemberRoleId: string = '360930752730234880';

async function sendAcmInfo(interaction: CommandInteraction) {
    try {
        const acmGeneralChannel = await interaction.guild?.channels.fetch('360933694443094016');
        await interaction.reply(`ACM stands for Association for Computing Machinery.${acmGeneralChannel ? `See ${acmGeneralChannel} for more info.` : ``}`);
    }
    catch (err) {
        await interaction.reply('Failed to find the ACM general channel.');
    }
}

async function leaveAcm(interaction: CommandInteraction): Promise<void> {
    const acmMemberRole = await interaction.guild?.roles.fetch(acmMemberRoleId);
    if (acmMemberRole) {
        if (interaction.options.getMember('member')) {
            await removeRoleFromOther(interaction, acmMemberRole);
        }
        else {
            await removeRoleFromSelf(interaction, acmMemberRole);
        }
    }
    else {
        await interaction.reply(`Failed to find the ACM Member role.`);
    }
}

async function joinAcm(interaction: CommandInteraction): Promise<void> {
    const acmMemberRole = await interaction.guild?.roles.fetch(acmMemberRoleId);
    if (acmMemberRole) {
        if (interaction.options.getMember('member')) {
            await addRoleToOther(interaction, acmMemberRole);
        }
        else {
            await addRoleToSelf(interaction, acmMemberRole);
        }
    }
    else {
        await interaction.reply(`Failed to find the ACM Member role.`);
    }
}
