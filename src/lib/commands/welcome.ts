import type { SlashCommandBuilder } from '@discordjs/builders';
import { ApplicationCommandPermissionData, CommandInteraction, Guild, GuildMember, Permissions, TextChannel } from 'discord.js';
import { Command, commandRolePermission, rolesWithPermissions } from '../command.js';
import { getCachedChannel } from '../utils.js';
import type { ClientInstance } from '../../client/client.js';
import { findServer } from '../../client/settings.js';

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
        await deferredWelcome(interaction, client, member);
    }
}

export const command: Command = new WelcomeCommand();

async function deferredWelcome(interaction: CommandInteraction, client: ClientInstance, member: GuildMember) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const success = await welcome(member, client);
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

export async function welcome(member: GuildMember, client: ClientInstance): Promise<boolean> {
    const server = findServer(member.guild);
    if (!server) {
        return false;
    }
    let success = await sendWelcomeMessage(member, server, client);
    success &&= await addDefaultRoles(member, server, client);
    return success;
}

interface ServerSettings {
    welcomeChannel: string;
    generalChannel: string;
    defaultRoles: string[];
}

async function sendWelcomeMessage(member: GuildMember, server: ServerSettings, client: ClientInstance) {
    const welcomeChannel = getCachedChannel(member.guild, server.welcomeChannel) as TextChannel;
    const generalChannel = getCachedChannel(member.guild, server.generalChannel) as TextChannel;
    if (!welcomeChannel || !generalChannel) {
        return false;
    }

    try {
        const msg =
        `${member.user} has logged on!
Please take a look at ${welcomeChannel} before you get started.`;
        await generalChannel.send({ content: msg });
        return true;
    }
    catch (err) {
        await client.reportError(err, 'sendWelcomeMessage');
        return false;
    }
}

async function addDefaultRoles(member: GuildMember, server: ServerSettings, client: ClientInstance) {
    try {
        const serverRoles = await member.guild.roles.fetch();
        const pendingAdds = server.defaultRoles
            .map(async (role) => {
                if (serverRoles.has(role)) {
                    await member.roles.add(role);
                }
            });
        await Promise.all(pendingAdds);
        return true;
    }
    catch (err) {
        await client.reportError(err, 'sendWelcomeMessage');
        return false;
    }
}