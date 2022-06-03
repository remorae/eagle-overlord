import { SlashCommandBuilder } from "@discordjs/builders";
import { ApplicationCommandPermissionData, Channel, CommandInteraction, Guild, GuildChannel, PartialDMChannel, Permissions, TextChannel, ThreadChannel } from "discord.js";
import { Command, commandRolePermission, rolesWithPermissions } from "../command";

class SayCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('say')
            .setDescription('Send a message to the current or specified channel.')
            .addStringOption((option) =>
                option
                    .setName('message')
                    .setDescription('What to say.')
                    .setRequired(true))
            .addChannelOption((option) =>
                option
                    .setName('channel')
                    .setDescription('The text channel to send the message to.'))
            .setDefaultPermission(false);
    }
    async getPermissions(guild: Guild, permissions: ApplicationCommandPermissionData[]) {
        for (const role of rolesWithPermissions(guild, Permissions.FLAGS.MANAGE_CHANNELS)) {
            permissions.push(commandRolePermission(role.id, true));
        }
    }
    async execute(interaction: CommandInteraction) {
        const message = interaction.options.getString('message', true);
        let channel: Channel | PartialDMChannel | null = interaction.channel;
        if (interaction.inGuild()) {
            const specifiedChannel = interaction.options.getChannel('channel', false);
            if (specifiedChannel instanceof GuildChannel) {
                channel = specifiedChannel;
            }
        }
        if (channel instanceof TextChannel || channel instanceof ThreadChannel) {
            await channel.send(message);
            await interaction.reply({ content: 'Done!', ephemeral: true });
        }
        else {
            await interaction.reply({ content: 'Channel is not a text/thread channel.', ephemeral: true });
        }
    }
}
export const command: Command = new SayCommand();