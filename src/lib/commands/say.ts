import type { SlashCommandBuilder } from 'discord.js';
import { Channel, ChatInputCommandInteraction, GuildChannel, PartialDMChannel, PermissionsBitField, TextChannel, ThreadChannel } from 'discord.js';
import type { ClientInstance } from '../../client/client.js';
import type { Command } from '../command.js';

class SayCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('say')
            .setDescription('Send a message to the current or specified channel.')
            .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
            .setDMPermission(false)
            .addStringOption((option) =>
                option
                    .setName('message')
                    .setDescription('What to say.')
                    .setRequired(true))
            .addChannelOption((option) =>
                option
                    .setName('channel')
                    .setDescription('The text channel to send the message to.'))
    }
    async execute(interaction: ChatInputCommandInteraction, _client: ClientInstance) {
        const message = interaction.options.getString('message', true);
        let textChannel: Channel | PartialDMChannel | null = interaction.channel;
        if (interaction.inGuild()) {
            const specifiedChannel = interaction.options.getChannel('channel', false);
            if (specifiedChannel instanceof GuildChannel) {
                textChannel = specifiedChannel;
            }
        }
        if (textChannel instanceof TextChannel || textChannel instanceof ThreadChannel) {
            await textChannel.send(message);
            await interaction.reply({ content: 'Done!', ephemeral: true });
        }
        else {
            await interaction.reply({ content: 'Channel is not a text/thread channel.', ephemeral: true });
        }
    }
}

export const command: Command = new SayCommand();