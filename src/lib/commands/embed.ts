import type { SlashCommandBuilder } from '@discordjs/builders';
import { ApplicationCommandPermissionData, CommandInteraction, Guild, GuildTextBasedChannel, HexColorString, MessageActionRow, MessageEmbed, Modal, ModalActionRowComponent, ModalSubmitInteraction, Permissions, TextInputComponent } from 'discord.js';
import type { ClientInstance } from '../../client/client.js';
import { Command, commandRolePermission, rolesWithPermissions } from '../command.js';
import { showTimedModal } from '../modal.js';

class EmbedCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('embed')
            .setDescription('Embed the given info in a new message in the given channel.')
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
            .setDefaultPermission(false);
    }
    async getPermissions(guild: Guild, permissions: ApplicationCommandPermissionData[]) {
        for (const role of rolesWithPermissions(guild, Permissions.FLAGS.MANAGE_CHANNELS)) {
            permissions.push(commandRolePermission(role.id, true));
        }
    }
    async execute(interaction: CommandInteraction, client: ClientInstance) {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }
        const channel = interaction.options.getChannel('channel', true);
        if (!('guild' in channel) || !channel.isText()) {
            await interaction.reply({ content: 'Channel is not a text/thread channel.', ephemeral: true });
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

async function createEmbedFromOptions(interaction: CommandInteraction) {
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

    const embed = new MessageEmbed()
        .setTitle(title)
        .setColor(color);
    return embed;
}

async function askForEmbedDescription(interaction: CommandInteraction, client: ClientInstance, channel: GuildTextBasedChannel, editID: string | null, embed: MessageEmbed) {
    const modal = buildDescriptionModal();
    const submission = await showTimedModal(interaction, modal);
    if (submission) {
        embed.setDescription(submission.fields.getTextInputValue('description'));
        await sendEmbed(submission, client, channel, editID, embed);
    }
}

function buildDescriptionModal() {
    return new Modal()
        .setCustomId('embedDescriptionModal')
        .setTitle(`Embed`)
        .addComponents(
            new MessageActionRow<ModalActionRowComponent>()
                .addComponents(
                    new TextInputComponent()
                        .setCustomId('description')
                        .setLabel('Description')
                        .setPlaceholder('Please enter the embed description...')
                        .setStyle('PARAGRAPH')
                        .setRequired(true)
                )
        );
}

async function sendEmbed(interaction: ModalSubmitInteraction, client: ClientInstance, channel: GuildTextBasedChannel, editID: string | null, embed: MessageEmbed) {
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

async function editMessageWithEmbed(interaction: ModalSubmitInteraction, client: ClientInstance, channel: GuildTextBasedChannel, editID: string, embed: MessageEmbed) {
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