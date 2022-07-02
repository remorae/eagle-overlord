import type { SlashCommandBuilder } from '@discordjs/builders';
import { Guild, CommandInteraction, GuildMember, Role, Permissions } from 'discord.js';
import type { ClientInstance } from '../../client.js';
import type { Command } from '../command.js';
import { acmMemberRoleId } from './acm.js';

class RoleCommand implements Command {
    // eslint-disable-next-line max-lines-per-function
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('role')
            .setDescription('Manage user roles.')
            .addSubcommandGroup(group =>
                group
                    .setName('add')
                    .setDescription('Add a role.')
                    .addSubcommand(command =>
                        command
                            .setName('self')
                            .setDescription('Add a role to yourself.')
                            .addRoleOption(option =>
                                option
                                    .setName('role')
                                    .setDescription('The role to add.')
                                    .setRequired(true)
                            )
                    )
                    .addSubcommand(command =>
                        command
                            .setName('other')
                            .setDescription('Add a role to the specified user.')
                            .addUserOption(option =>
                                option
                                    .setName('member')
                                    .setDescription('The user to add the role to.')
                                    .setRequired(true)
                            )
                            .addRoleOption(option =>
                                option
                                    .setName('role')
                                    .setDescription('The role to add.')
                                    .setRequired(true)
                            )
                    )
                    .addSubcommand(command =>
                        command
                            .setName('all')
                            .setDescription('Add a role to everyone.')
                            .addRoleOption(option =>
                                option
                                    .setName('role')
                                    .setDescription('The role to add.')
                                    .setRequired(true)
                            )
                    )
            )
            .addSubcommandGroup(group =>
                group
                    .setName('remove')
                    .setDescription('Remove a role.')
                    .addSubcommand(command =>
                        command
                            .setName('self')
                            .setDescription('Remove a role from yourself.')
                            .addRoleOption(option =>
                                option
                                    .setName('role')
                                    .setDescription('The role to remove.')
                                    .setRequired(true)
                            )
                    )
                    .addSubcommand(command =>
                        command
                            .setName('other')
                            .setDescription('Remove a role from the specified user.')
                            .addUserOption(option =>
                                option
                                    .setName('member')
                                    .setDescription('The user to remove the role from.')
                                    .setRequired(true)
                            )
                            .addRoleOption(option =>
                                option
                                    .setName('role')
                                    .setDescription('The role to remove.')
                                    .setRequired(true)
                            )
                    )
                    .addSubcommand(command =>
                        command
                            .setName('all')
                            .setDescription('Remove a role from everyone.')
                            .addRoleOption(option =>
                                option
                                    .setName('role')
                                    .setDescription('The role to remove.')
                                    .setRequired(true)
                            )
                    )
            );
    }
    async execute(interaction: CommandInteraction, _client: ClientInstance): Promise<void> {
        if (!(interaction.member instanceof GuildMember) || !interaction.guild) {
            await interaction.reply({ content: 'You must be in a guild to use this command.', ephemeral: true });
            return;
        }
        const subCommandGroup = interaction.options.getSubcommandGroup();
        const role = interaction.options.getRole('role');
        if (!(role instanceof Role)) {
            await interaction.reply({ content: 'Invalid role.', ephemeral: true });
            return;
        }
        switch (subCommandGroup) {
            case 'add':
                await addRole(interaction, role);
                break;
            case 'remove':
                await removeRole(interaction, role);
                break;
            default:
                await interaction.reply({ content: 'Invalid subcommand group.', ephemeral: true });
                break;
        }
    }
}

export async function removeRole(interaction: CommandInteraction, role: Role): Promise<void> {
    if (!(interaction.member instanceof GuildMember) || !interaction.guild) {
        return;
    }
    if (interaction.member.permissions.has(role.permissions)) {
        const subCommand = interaction.options.getSubcommand();
        switch (subCommand) {
            case 'self':
                await removeRoleFromSelf(interaction, role);
                break;
            case 'other':
                await removeRoleFromOther(interaction, role);
                break;
            case 'all':
                await removeRoleFromAll(interaction, role);
                break;
            default:
                await interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
                break;
        }
    }
    else {
        await interaction.reply('You do not have permission to remove this role.');
    }
}

async function removeRoleFromAll(interaction: CommandInteraction, role: Role): Promise<void> {
    if (!(interaction.member instanceof GuildMember) || !interaction.guild) {
        return;
    }
    if (await hasPermissionToManageRole(interaction.member, role, true)) {
        await deferredBatchRemove(interaction, interaction.guild, role);
    }
    else {
        await interaction.reply('You do not have permission to remove roles from other users.');
    }
}

async function deferredBatchRemove(interaction: CommandInteraction, guild: Guild, role: Role) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const members = await guild.members.fetch();
        const pendingRemoves = members
            .map(async (member, _id) => {
                if (member.roles.cache.has(role.id)) {
                    await member.roles.remove(role);
                    return true;
                }
                return false;
            });
        const numRemoved = (await Promise.all(pendingRemoves))
            .filter(removed => removed)
            .length;
        await interaction.editReply({ content: `Removed role ${role} from ${numRemoved} users.`, allowedMentions: { users: [], roles: [] } });
    }
    catch (err) {
        await interaction.editReply({ content: 'Something went wrong! The bot might lack permission to remove the role.' });
    }
}

export async function removeRoleFromOther(interaction: CommandInteraction, role: Role): Promise<void> {
    if (!(interaction.member instanceof GuildMember) || !interaction.guild) {
        return;
    }
    if (await hasPermissionToManageRole(interaction.member, role, false)) {
        const member = interaction.options.getMember('member');
        if (!(member instanceof GuildMember)) {
            await interaction.reply({ content: 'Invalid user.', ephemeral: true });
        }
        else if (member.roles.cache.has(role.id)) {
            await removeMemberRole(interaction, member, role);
        }
        else {
            await interaction.reply({ content: `${member} does not have this role.`, ephemeral: true, allowedMentions: { users: [] } });
        }
    }
    else {
        await interaction.reply('You do not have permission to remove roles from other users.');
    }
}

async function removeMemberRole(interaction: CommandInteraction, member: GuildMember, role: Role) {
    try {
        await member.roles.remove(role);
        if (member === interaction.member) {
            await interaction.reply({ content: `Removed role ${role}.`, allowedMentions: { roles: [] } });
        }
        else {
            await interaction.reply({ content: `Removed role ${role} from ${member}.`, allowedMentions: { users: [], roles: [] } });
        }
    }
    catch (err) {
        await interaction.reply({ content: 'Something went wrong! The bot might lack permission to remove the role.' });
        throw err;
    }
}

export async function removeRoleFromSelf(interaction: CommandInteraction, role: Role): Promise<void> {
    if (!(interaction.member instanceof GuildMember) || !interaction.guild) {
        return;
    }
    if (interaction.member.roles.cache.has(role.id)) {
        await removeMemberRole(interaction, interaction.member, role);
    }
    else {
        await interaction.reply({ content: 'You do not have this role.', ephemeral: true });
    }
}

async function addRole(interaction: CommandInteraction, role: Role): Promise<void> {
    if (!(interaction.member instanceof GuildMember) || !interaction.guild) {
        return;
    }
    if (interaction.member.permissions.has(role.permissions)) {
        const subCommand = interaction.options.getSubcommand();
        switch (subCommand) {
            case 'self':
                await addRoleToSelf(interaction, role);
                break;
            case 'other':
                await addRoleToOther(interaction, role);
                break;
            case 'all':
                await addRoleToAll(interaction, role);
                break;
            default:
                await interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
                break;
        }
    }
    else {
        await interaction.reply('You do not have permission to add this role.');
    }
}

async function addRoleToAll(interaction: CommandInteraction, role: Role): Promise<void> {
    if (!(interaction.member instanceof GuildMember) || !interaction.guild) {
        return;
    }
    if (await hasPermissionToManageRole(interaction.member, role, true)) {
        await deferredBatchAdd(interaction, interaction.guild, role);
    }
    else {
        await interaction.reply('You do not have permission to add roles to other users.');
    }
}

async function deferredBatchAdd(interaction: CommandInteraction, guild: Guild, role: Role) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const members = await guild.members.fetch();
        const pendingAdds = members
            .map(async (member, _id) => {
                if (!member.roles.cache.has(role.id)) {
                    await member.roles.add(role);
                    return true;
                }
                return false;
            });
        const numAdded = (await Promise.all(pendingAdds))
            .filter(added => added)
            .length;
        await interaction.editReply({ content: `Added role ${role} to ${numAdded} users.`, allowedMentions: { users: [], roles: [] } });
    }
    catch (err) {
        await interaction.editReply({ content: 'Something went wrong! The bot might lack permission to add the role.' });
        throw err;
    }
}

export async function addRoleToOther(interaction: CommandInteraction, role: Role): Promise<void> {
    if (!(interaction.member instanceof GuildMember) || !interaction.guild) {
        return;
    }
    if (await hasPermissionToManageRole(interaction.member, role, false)) {
        const member = interaction.options.getMember('member');
        if (!(member instanceof GuildMember)) {
            await interaction.reply({ content: 'Invalid user.', ephemeral: true });
        }
        else if (member.roles.cache.has(role.id)) {
            await interaction.reply({ content: `${member} already has this role.`, ephemeral: true, allowedMentions: { users: [] } });
        }
        else {
            await addMemberRole(interaction, member, role);
        }
    }
    else {
        await interaction.reply('You do not have permission to add roles to other users.');
    }
}

async function addMemberRole(interaction: CommandInteraction, member: GuildMember, role: Role) {
    try {
        await member.roles.add(role);
        if (member === interaction.member) {
            await interaction.reply({ content: `Added role ${role}.`, allowedMentions: { roles: [] } });
        }
        else {
            await interaction.reply({ content: `Added role ${role} to ${member}.`, allowedMentions: { users: [], roles: [] } });
        }
    }
    catch (err) {
        await interaction.reply({ content: 'Something went wrong! The bot might lack permission to add the role.' });
        throw err;
    }
}

export async function addRoleToSelf(interaction: CommandInteraction, role: Role): Promise<void> {
    if (!(interaction.member instanceof GuildMember) || !interaction.guild) {
        return;
    }
    if (interaction.member.roles.cache.has(role.id)) {
        await interaction.reply({ content: 'You already have this role.', ephemeral: true });
    }
    else {
        await addMemberRole(interaction, interaction.member, role);
    }
}

async function hasPermissionToManageRole(member: GuildMember, role: Role, forAll: boolean): Promise<boolean> {
    if (!member.permissions.has(role.permissions)) {
        return false;
    }
    if (member.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) {
        return true;
    }
    if (forAll) {
        return false;
    }
    return hasPermissionToManageSpecificRole(member, role);
}

async function hasPermissionToManageSpecificRole(member: GuildMember, role: Role) {
    if (await allowAcmManagement(member, role)) {
        return true;
    }
    if (await allowCscManagement(member, role)) {
        return true;
    }
    return false;
}

export const command: Command = new RoleCommand();

async function allowAcmManagement(member: GuildMember, role: Role): Promise<boolean> {
    const acmLeaderRole = await member.guild.roles.fetch('360928722095702019');
    if (acmLeaderRole && member.roles.cache.has(acmLeaderRole.id) && role.id === acmMemberRoleId) {
        return true;
    }
    return false;
}

async function allowCscManagement(member: GuildMember, role: Role): Promise<boolean> {
    const cscLeaderRole = await member.guild.roles.fetch('497912789059371009');
    const cscMemberRoleId = '497912984958402580';
    if (cscLeaderRole && member.roles.cache.has(cscLeaderRole.id) && role.id === cscMemberRoleId) {
        return true;
    }
    return false;
}
