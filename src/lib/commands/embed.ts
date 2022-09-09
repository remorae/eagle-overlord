import type { SlashCommandBuilder } from 'discord.js';
import { CommandInteraction, GuildTextBasedChannel, HexColorString, ActionRowBuilder, ModalBuilder, ModalSubmitInteraction, ChatInputCommandInteraction, ChannelType, EmbedBuilder, ModalActionRowComponentBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } from 'discord.js';
import type { ClientInstance } from '../../client/client.js';
import type { Command } from '../command.js';
import { showTimedModal } from '../modal.js';

class EmbedCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('embed')
            .setDescription('Embed the given info in a new message in the given channel.')
            .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
            .setDMPermission(false)
            .addChannelOption((option) =>
                option
                    .setName('channel')
                    .setDescription('The text channel to send the message to.')
                    .setRequired(true)
            )
            .addStringOption((option) =>
                option
                    .setName('title')
                    .setDescription('The title of the embed.')
                    .setRequired(true)
            )
            .addStringOption((option) =>
                option
                    .setName('color')
                    .setDescription('The color of the embed, e.g. 0xff0000.')
                    .setRequired(true)
            )
            .addStringOption((option) =>
                option
                    .setName('edit_id')
                    .setDescription('The ID of the message to edit.')
            )
    }
    async execute(interaction: ChatInputCommandInteraction, client: ClientInstance) {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }
        const channel = interaction.options.getChannel('channel', true);
        if (!('guild' in channel) || !(channel.type === ChannelType.GuildText)) {
            await interaction.reply({ content: 'Channel is not a text channel.', ephemeral: true });
            return;
        }
        const embed = await createEmbedFromOptions(interaction);
        if (embed) {
            const editID = interaction.options.getString('edit_id', false);
            await askForEmbedDescription(interaction, client, channel, editID, embed);
        }
    }
}

export const command: Command = new EmbedCommand();

async function createEmbedFromOptions(interaction: ChatInputCommandInteraction) {
    const title = interaction.options.getString('title', true);
    const colorStr = interaction.options.getString('color', true);
    let color = null;
    try {
        color = colorStr.startsWith('0x')
            ? `#${colorStr.slice('0x'.length)}` as HexColorString
            : parseInt(colorStr, 10);
    }
    catch (e) {
    }
    if (!color || (typeof color === "number" && Number.isNaN(color))) {
        await interaction.reply({ content: 'Invalid color.', ephemeral: true });
        return null;
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color);
    return embed;
}

async function askForEmbedDescription(interaction: CommandInteraction, client: ClientInstance, channel: GuildTextBasedChannel, editID: string | null, embed: EmbedBuilder) {
    const modal = buildDescriptionModal();
    const submission = await showTimedModal(interaction, modal);
    if (submission) {
        embed.setDescription(submission.fields.getTextInputValue('description'));
        await sendEmbed(submission, client, channel, editID, embed);
    }
}

function buildDescriptionModal() {
    return new ModalBuilder()
        .setCustomId('embedDescriptionModal')
        .setTitle(`Embed`)
        .addComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId('description')
                        .setLabel('Description')
                        .setPlaceholder('Please enter the embed description...')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                )
        );
}

async function sendEmbed(interaction: ModalSubmitInteraction, client: ClientInstance, channel: GuildTextBasedChannel, editID: string | null, embed: EmbedBuilder) {
    try {
        if (editID) {
            await editMessageWithEmbed(interaction, client, channel, editID, embed);
        }
        else {
            await channel.send({ embeds: [embed] });
            await interaction.followUp({ content: 'Done!', ephemeral: true });
        }
    }
    catch (e) {
        await client.reportError(e, 'EmbedCommand::execute');
        await interaction.followUp({ content: 'Something went wrong!' });
    }
}

async function editMessageWithEmbed(interaction: ModalSubmitInteraction, client: ClientInstance, channel: GuildTextBasedChannel, editID: string, embed: EmbedBuilder) {
    let messageToEdit = null;
    try {
        messageToEdit = await channel.messages.fetch(editID);
    }
    catch (e) {
        await client.reportError(e);
        await interaction.followUp({ content: 'Invalid message to edit.', ephemeral: true });
    }
    if (messageToEdit) {
        await messageToEdit.edit({ embeds: [embed] });
        await interaction.followUp({ content: 'Done!', ephemeral: true });
    }
}