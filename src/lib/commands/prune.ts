import type { SlashCommandBuilder } from '@discordjs/builders';
import { Guild, CommandInteraction, Permissions, Modal, MessageActionRow, ModalActionRowComponent, TextInputComponent, ModalSubmitInteraction, Role } from 'discord.js';
import type { ClientInstance } from '../../client/client.js';
import type { Command } from '../command.js';
import { showTimedModal } from '../modal.js';

class PruneCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('prune')
            .setDescription('Prune members.')
            .setDefaultMemberPermissions(Permissions.FLAGS.KICK_MEMBERS)
            .setDMPermission(false)
            .addIntegerOption((option) =>
                option
                    .setName("days")
                    .setDescription("Number of days of inactivity required to kick")
                    .setMinValue(1)
                    .setMaxValue(30)
                    .setRequired(false))
            .addBooleanOption((option) =>
                option
                    .setName("dry")
                    .setDescription("Get the number of users that will be kicked, without actually kicking them")
                    .setRequired(false))
            .addBooleanOption((option) =>
                option
                    .setName("count")
                    .setDescription("Whether of not to return the number of users that have been kicked")
                    .setRequired(false));
    }
    async execute(interaction: CommandInteraction, client: ClientInstance): Promise<void> {
        if (!interaction.inCachedGuild()) {
            await interaction.reply({ content: 'You must be in a guild to use this command.', ephemeral: true });
            return;
        }
        const modal = buildRolesModal();
        const submission = await showTimedModal(interaction, modal);
        await processPrune(interaction, submission, client);
    }
}

function buildRolesModal() {
    return new Modal()
        .setCustomId('pruneRolesModal')
        .setTitle(`Prune Members`)
        .addComponents(
            new MessageActionRow<ModalActionRowComponent>()
                .addComponents(
                    new TextInputComponent()
                        .setCustomId('roles')
                        .setLabel('Roles')
                        .setPlaceholder('Optional list of roles to bypass the "...and no roles" constraint when pruning')
                        .setStyle('PARAGRAPH')
                        .setRequired(false)
                )
        );
}

async function processPrune(interaction: CommandInteraction & { guild: Guild; }, submission: ModalSubmitInteraction | null, client: ClientInstance) {
    try {
        const roles = submission?.fields.getTextInputValue("roles")
            .split('\n')
            .map((line) => {
                return interaction.guild.roles.cache.find((r) => {
                    return r.name === line
                        || (line.length > 0 && line.at(0) === '@' && r.name === line.substring(1))
                        || r.id === line;
                });
            })
            .filter((r) => r)
            .map((r) => r as Role) ?? [];
        const pruned = await interaction.guild.members.prune({
            days: interaction.options.getInteger("days", false) ?? 7,
            dry: interaction.options.getBoolean("dry", false) ?? false,
            count: interaction.options.getBoolean("count", false) ?? false,
            roles,
        });
        await interaction.followUp({ content: `Pruned ${pruned} members with roles: ${roles}.`, allowedMentions: { users: [], roles: [] } });
    }
    catch (e) {
        await client.reportError(e);
        await interaction.followUp({ content: 'Something went wrong! The bot might lack permission to prune.', ephemeral: true });
    }
}

export const command: Command = new PruneCommand();
