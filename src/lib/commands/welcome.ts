import type { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, GuildMember, Permissions } from 'discord.js';
import type { Command } from '../command.js';
import type { ClientInstance } from '../../client/client.js';
import { findServer, findServerChannel, ServerSettings } from '../../client/settings.js';

class WelcomeCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('welcome')
            .setDescription('Simulates a welcome event for the given user.')
            .setDefaultMemberPermissions(Permissions.FLAGS.MANAGE_CHANNELS)
            .setDMPermission(false)
            .addUserOption((option) =>
                option
                    .setName('user')
                    .setDescription('The user to welcome.')
                    .setRequired(true)
            )
    }
    async execute(interaction: CommandInteraction, client: ClientInstance) {
        if (!interaction.inCachedGuild()) {
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
    let success = await sendWelcomeMessage(member, client);
    success &&= await addDefaultRoles(member, server, client);
    return success;
}

async function sendWelcomeMessage(member: GuildMember, client: ClientInstance) {
    const welcomeChannel = await findServerChannel(member.guild, "welcome");
    const generalChannel = await findServerChannel(member.guild, "general");
    if (!welcomeChannel) {
        return false;
    }
    if (!generalChannel?.isText()) {
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
        const pendingAdds = server.roles
            .filter((role) => role.default)
            .map(async (role) => {
                if (serverRoles.has(role.id)) {
                    await member.roles.add(role.id);
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