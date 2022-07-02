import type { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, GuildMember } from 'discord.js';
import type { ClientInstance } from '../../client.js';
import type { Command } from '../command.js';
import { addRoleToOther, addRoleToSelf, removeRoleFromOther, removeRoleFromSelf } from './role.js';

class CscCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('csc')
            .setDescription('Manage or display CSC information.')
            .addSubcommand(command =>
                command
                    .setName('join')
                    .setDescription('Join CSC or add the specified user.')
                    .addUserOption(option =>
                        option
                            .setName('member')
                            .setDescription('The user to add to CSC.')
                    )
            )
            .addSubcommand(command =>
                command
                    .setName('leave')
                    .setDescription('Leave CSC or remove the specified user.')
                    .addUserOption(option =>
                        option
                            .setName('member')
                            .setDescription('The user to remove from CSC.')
                    )
            )
            .addSubcommand(command =>
                command
                    .setName('info')
                    .setDescription('Get information about CSC.')
            );
    }
    async execute(interaction: CommandInteraction, _client: ClientInstance): Promise<void> {
        if (!(interaction.member instanceof GuildMember) || !interaction.guild) {
            await interaction.reply({ content: 'You must be in a guild to use this command.', ephemeral: true });
            return;
        }
        const subCommand = interaction.options.getSubcommand();
        switch (subCommand) {
            case 'join':
                await joinCsc(interaction);
                break;
            case 'leave':
                await leaveCsc(interaction);
                break;
            case 'info':
                await sendCscInfo(interaction);
                break;
            default:
                await interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
                break;
        }
    }
}

export const command: Command = new CscCommand();

export const cscMemberRoleId = '497912984958402580';
export const cscCompetitionRoleId = '507354887655522347';

async function sendCscInfo(interaction: CommandInteraction) {
    try {
        const cscGeneralChannel = await interaction.guild?.channels.fetch('497914273373224960');
        await interaction.reply(`CSC stands for Cyber Security Club.${cscGeneralChannel ? `See ${cscGeneralChannel} for more info.` : ''}`);
    }
    catch (err) {
        await interaction.reply('Failed to find the CSC general channel.');
    }
}

async function leaveCsc(interaction: CommandInteraction): Promise<void> {
    const cscMemberRole = await interaction.guild?.roles.fetch(cscMemberRoleId);
    if (cscMemberRole) {
        if (interaction.options.getMember('member')) {
            await removeRoleFromOther(interaction, cscMemberRole);
        }
        else {
            await removeRoleFromSelf(interaction, cscMemberRole);
        }
    }
    else {
        await interaction.reply('Failed to find the CSC Member role.');
    }
}

async function joinCsc(interaction: CommandInteraction): Promise<void> {
    const cscMemberRole = await interaction.guild?.roles.fetch(cscMemberRoleId);
    if (cscMemberRole) {
        if (interaction.options.getMember('member')) {
            await addRoleToOther(interaction, cscMemberRole);
        }
        else {
            await addRoleToSelf(interaction, cscMemberRole);
        }
    }
    else {
        await interaction.reply('Failed to find the CSC Member role.');
    }
}