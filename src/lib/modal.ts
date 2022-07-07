import type { CommandInteraction, Modal, ModalSubmitInteraction } from 'discord.js';
import { MILLIS_PER_SECOND } from './timeUtils.js';

export async function showTimedModal(interaction: CommandInteraction, modal: Modal): Promise<ModalSubmitInteraction | null> {
    const TIMEOUT_SECONDS = 60;
    await interaction.showModal(modal);
    try {
        return interaction.awaitModalSubmit({
            filter: async (i: ModalSubmitInteraction) => {
                await i.deferUpdate();
                return i.user.id === interaction.user.id;
            },
            time: TIMEOUT_SECONDS * MILLIS_PER_SECOND
        });
    }
    catch (err) {
        await interaction.followUp({ content: `Timed out waiting for reply after ${TIMEOUT_SECONDS} seconds.`, ephemeral: true });
        return null;
    }
}