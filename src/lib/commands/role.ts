import type { SlashCommandBuilder } from 'discord.js';
import { Guild, CommandInteraction, GuildMember, Role, ChatInputCommandInteraction, PermissionsBitField } from 'discord.js';
import type { ClientInstance } from '../../client/client.js';
import { findServerRole } from '../../client/settings.js';
import type { Command } from '../command.js';

class RoleCommand implements Command {
    // eslint-disable-next-line max-lines-per-function
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('role')
            .setDescription('Manage user roles.')
            .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
            .setDMPermission(false)
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
                    .addSubcommand(command =>
                        command
                            .setName('role')
                            .setDescription('Delete the role.')
                            .addRoleOption(option =>
                                option
                                    .setName('role')
                                    .setDescription('The role to remove.')
                                    .setRequired(true)
                            )
                    )
            )
    }
    async execute(interaction: ChatInputCommandInteraction, _client: ClientInstance): Promise<void> {
        if (!interaction.inCachedGuild()) {
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

async function replyWithError(interaction: CommandInteraction, status: PermissionStatus, edit: boolean) {
    let msg = "Something went wrong!";
    let ephemeral = true;
    switch (status) {
        case PermissionStatus.Ok:
            ephemeral = false;
            break;
        case PermissionStatus.InsufficientAppPermissions:
            msg = "Insufficient application permissions.";
            break;
        case PermissionStatus.InsufficientMemberPermissions:
            msg = "Insufficient user permissions.";
            break;
        case PermissionStatus.CannotManageRoles:
            msg = "Insufficient user permissions to manage roles.";
            break;
        case PermissionStatus.InsufficientRoleSpecificPermissions:
            msg = "Insufficient role-specific permissions.";
            break;
    }
    if (edit) {
        await interaction.editReply({ content: msg });
    }
    else {
        await interaction.reply({ content: msg, ephemeral });
    }
}

export async function removeRole(interaction: ChatInputCommandInteraction, role: Role): Promise<void> {
    if (!interaction.inCachedGuild()) {
        return;
    }
    const subCommand = interaction.options.getSubcommand();
    const status = await hasPermissionToManageRole(interaction.member, role, getRoleCommandTarget(subCommand), interaction.appPermissions);
    if (status == PermissionStatus.Ok) {
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
            case 'role':
                await deleteRole(interaction, role);
                break;
            default:
                await interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
                break;
        }
    }
    else {
        await replyWithError(interaction, status, false);
    }
}

async function removeRoleFromAll(interaction: CommandInteraction, role: Role): Promise<void> {
        if (!interaction.inCachedGuild()) {
        return;
    }
    const status = await hasPermissionToManageRole(interaction.member, role, RoleTarget.All, interaction.appPermissions);
    if (status == PermissionStatus.Ok) {
        await deferredBatchRemove(interaction, interaction.guild, role);
    }
    else {
        await replyWithError(interaction, status, false);
    }
}

async function deleteRole(interaction: CommandInteraction, role: Role): Promise<void> {
    if (!interaction.inCachedGuild()) {
        return;
    }
    const status = await hasPermissionToManageRole(interaction.member, role, RoleTarget.All, interaction.appPermissions);
    if (status == PermissionStatus.Ok) {
        await deferredDelete(interaction, interaction.guild, role);
    }
    else {
        await replyWithError(interaction, status, false);
    }
}

async function deferredBatchRemove(interaction: CommandInteraction, guild: Guild, role: Role) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const members = await guild.members.fetch();
        const pendingRemoves = members
            .map(async (member, _id) => {
                if (member.roles.cache.has(role.id)) {
                    await member.roles.remove(role, `command entered by ${interaction.member?.user.username}`);
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
        await replyWithError(interaction, PermissionStatus.Ok, true);
    }
}

async function deferredDelete(interaction: CommandInteraction, guild: Guild, role: Role) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const members = await guild.members.fetch();
        const numRemoved = members
            .filter((member, _id) => {
                return member.roles.cache.has(role.id);
            })
            .size;
        await guild.roles.delete(role, `command entered by ${interaction.member?.user.username}`);
        await interaction.editReply({ content: `Removed role ${role} from ${numRemoved} users and deleted it.`, allowedMentions: { users: [], roles: [] } });
    }
    catch (err) {
        await replyWithError(interaction, PermissionStatus.Ok, true);
    }
}

export async function removeRoleFromOther(interaction: CommandInteraction, role: Role): Promise<void> {
    if (!interaction.inCachedGuild()) {
        return;
    }
    const status = await hasPermissionToManageRole(interaction.member, role, RoleTarget.Other, interaction.appPermissions);
    if (status == PermissionStatus.Ok) {
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
        await replyWithError(interaction, status, false);
    }
}

async function removeMemberRole(interaction: CommandInteraction, member: GuildMember, role: Role) {
    try {
        await member.roles.remove(role, `command entered by ${interaction.member?.user.username}`);
        if (member === interaction.member) {
            await interaction.reply({ content: `Removed role ${role}.`, allowedMentions: { roles: [] } });
        }
        else {
            await interaction.reply({ content: `Removed role ${role} from ${member}.`, allowedMentions: { users: [], roles: [] } });
        }
    }
    catch (err) {
        await replyWithError(interaction, PermissionStatus.Ok, false);
        throw err;
    }
}

export async function removeRoleFromSelf(interaction: CommandInteraction, role: Role): Promise<void> {
    if (!interaction.inCachedGuild()) {
        return;
    }
    if (interaction.member.roles.cache.has(role.id)) {
        await removeMemberRole(interaction, interaction.member, role);
    }
    else {
        await interaction.reply({ content: 'You do not have this role.', ephemeral: true });
    }
}

function getRoleCommandTarget(subCommand: string): RoleTarget {
    switch (subCommand) {
        case 'self':
            return RoleTarget.Self;
        case 'other':
            return RoleTarget.Other;
        case 'all':
        case 'role':
            return RoleTarget.All;
        default:
            return RoleTarget.Self;
    }
}

async function addRole(interaction: ChatInputCommandInteraction, role: Role): Promise<void> {
    if (!interaction.inCachedGuild()) {
        return;
    }
    const subCommand = interaction.options.getSubcommand();
    const status = await hasPermissionToManageRole(interaction.member, role, getRoleCommandTarget(subCommand), interaction.appPermissions);
    if (status == PermissionStatus.Ok) {
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
        await replyWithError(interaction, status, false);
    }
}

async function addRoleToAll(interaction: CommandInteraction, role: Role): Promise<void> {
    if (!interaction.inCachedGuild()) {
        return;
    }
    const status = await hasPermissionToManageRole(interaction.member, role, RoleTarget.All, interaction.appPermissions);
    if (status == PermissionStatus.Ok) {
        await deferredBatchAdd(interaction, interaction.guild, role);
    }
    else {
        await replyWithError(interaction, status, false);
    }
}

async function deferredBatchAdd(interaction: CommandInteraction, guild: Guild, role: Role) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const members = await guild.members.fetch();
        const pendingAdds = members
            .map(async (member, _id) => {
                if (!member.roles.cache.has(role.id)) {
                    await member.roles.add(role, `command entered by ${interaction.member?.user.username}`);
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
        await replyWithError(interaction, PermissionStatus.Ok, true);
        throw err;
    }
}

export async function addRoleToOther(interaction: CommandInteraction, role: Role): Promise<void> {
    if (!interaction.inCachedGuild()) {
        return;
    }
    const status = await hasPermissionToManageRole(interaction.member, role, RoleTarget.Other, interaction.appPermissions);
    if (status == PermissionStatus.Ok) {
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
        await replyWithError(interaction, status, false);
    }
}

async function addMemberRole(interaction: CommandInteraction, member: GuildMember, role: Role) {
    try {
        await member.roles.add(role, `command entered by ${interaction.member?.user.username}`);
        if (member === interaction.member) {
            await interaction.reply({ content: `Added role ${role}.`, allowedMentions: { roles: [] } });
        }
        else {
            await interaction.reply({ content: `Added role ${role} to ${member}.`, allowedMentions: { users: [], roles: [] } });
        }
    }
    catch (err) {
        await replyWithError(interaction, PermissionStatus.Ok, false);
        throw err;
    }
}

export async function addRoleToSelf(interaction: CommandInteraction, role: Role): Promise<void> {
    if (!interaction.inCachedGuild()) {
        return;
    }
    if (interaction.member.roles.cache.has(role.id)) {
        await interaction.reply({ content: 'You already have this role.', ephemeral: true });
    }
    else {
        await addMemberRole(interaction, interaction.member, role);
    }
}

enum PermissionStatus {
    Ok,
    InsufficientAppPermissions,
    InsufficientMemberPermissions,
    CannotManageRoles,
    InsufficientRoleSpecificPermissions,
}

enum RoleTarget {
    Self,
    Other,
    All,
}

async function hasPermissionToManageRole(member: GuildMember, role: Role, target: RoleTarget, appPermissions: Readonly<PermissionsBitField> | null): Promise<PermissionStatus> {
    if (!appPermissions?.has(role.permissions)) {
        return PermissionStatus.InsufficientAppPermissions;
    }
    if (!member.permissions.has(role.permissions)) {
        return PermissionStatus.InsufficientMemberPermissions;
    }
    if (target === RoleTarget.Self) {
        return PermissionStatus.Ok;
    }
    if (member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return PermissionStatus.Ok;
    }
    if (target === RoleTarget.All) {
        return PermissionStatus.CannotManageRoles;
    }
    return hasPermissionToManageSpecificRole(member, role);
}

async function hasPermissionToManageSpecificRole(member: GuildMember, role: Role): Promise<PermissionStatus> {
    if (await allowAcmManagement(member, role)) {
        return PermissionStatus.Ok;
    }
    if (await allowCscManagement(member, role)) {
        return PermissionStatus.Ok;
    }
    return PermissionStatus.InsufficientRoleSpecificPermissions;
}

export const command: Command = new RoleCommand();

async function allowAcmManagement(member: GuildMember, role: Role): Promise<boolean> {
    const acmLeaderRole = await findServerRole(member.guild, "acmLeader");
    const acmMemberRole = await findServerRole(member.guild, "acmMember");
    if (acmLeaderRole && acmMemberRole && member.roles.cache.has(acmLeaderRole.id) && role.id === acmMemberRole.id) {
        return true;
    }
    return false;
}

async function allowCscManagement(member: GuildMember, role: Role): Promise<boolean> {
    const cscLeaderRole = await findServerRole(member.guild, "cscLeader");
    const cscMemberRole = await findServerRole(member.guild, "cscMember");
    if (cscLeaderRole && cscMemberRole && member.roles.cache.has(cscLeaderRole.id) && role.id === cscMemberRole.id) {
        return true;
    }
    return false;
}
