import { SlashCommandBuilder } from '@discordjs/builders';
import type { ApplicationCommand, CommandInteraction, GuildResolvable } from 'discord.js';
import type { ClientInstance } from '../../client/client.js';
import { findServerChannel } from '../../client/settings.js';
import { Command, getCommandsOnDisk } from '../command.js';

class HelpCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        const otherCommands = await Promise.all(
            (await getCommandsOnDisk(false))
                .filter(c => !(c instanceof HelpCommand))
                .map(async (command) => {
                    const otherBuilder = new SlashCommandBuilder();
                    await command.build(otherBuilder);
                    return { name: otherBuilder.name, value: otherBuilder.name };
                }));
        builder
            .setName('help')
            .setDescription('Displays helpful information about command usage.')
            .setDMPermission(true)
            .addStringOption((option) =>
                option
                    .setName('command')
                    .setDescription('The command to get information about.')
                    .addChoices(...otherCommands));
    }
    async execute(interaction: CommandInteraction, client: ClientInstance): Promise<void> {
        const specifiedCommand = interaction.options.getString('command', false);
        if (specifiedCommand) {
            interaction.deferReply({ ephemeral: true });
            const command = await getDeployedCommand(interaction, specifiedCommand);
            if (command) {
                await sendCommandHelp(command, interaction, client);
            }
            else {
                await interaction.followUp({ content: 'Unrecognized command. Slash commands may still be deploying.' });
            }
        }
        else {
            await sendGeneralHelp(interaction);
        }
    }
}

export const command: Command = new HelpCommand();

async function getRequiredOptions(cmd: ApplicationCommand, client: ClientInstance): Promise<string[]> {
    const cachedCommand = client.getCachedCommands().get(cmd.name);
    const builder = (cachedCommand) ? new SlashCommandBuilder() : undefined;
    if (builder) {
        await cachedCommand?.build(builder);
    }
    const builtOptions = builder?.options.map((o) => o.toJSON());
    return cmd.options.map(o => o.name).filter((name) => {
        const deployedOption = builtOptions?.find((o) => o.name === name);
        if (!deployedOption) {
            client.reportError(`Couldn't find deployed option with name: ${name}`, 'getRequiredOptions');
        }
        return deployedOption?.required;
    });
}

async function sendCommandHelp(cmd: ApplicationCommand<{ guild?: GuildResolvable; }>, interaction: CommandInteraction, client: ClientInstance): Promise<void> {
    const requiredOptions = await getRequiredOptions(cmd, client);
    let usage = `\`/${cmd.name}`;
    for (const option of cmd.options) {
        usage += ` ${(requiredOptions.includes(option.name)) ? `<${option.name}>` : `[${option.name}]`}`;
    }
    usage += '`';
    for (const option of cmd.options) {
        usage += `\n\`${option.name}\`: ${requiredOptions.includes(option.name) ? 'Required' : 'Optional'}. ${option.description}`;
    }
    const msg =
`Usage: ${usage}
Info: ${cmd.description}`;
    await interaction.followUp({ content: msg });
}

async function sendGeneralHelp(interaction: CommandInteraction): Promise<void> {
    const helpChannel = interaction.guild ? findServerChannel(interaction.guild, 'help') : null;
    let msg =
`If you'd like help with specific command syntax, please use \`/help <commandName>\`.
If you'd like to see available commands, please use \`/commands\`.`;
    if (helpChannel) {
        msg += `\nIf you need help with Discord or something not specific to a class, please ask a question in ${helpChannel}.`;
    }
    await interaction.reply({ content: msg });
}

async function getDeployedCommand(interaction: CommandInteraction, specifiedCommand: string): Promise<ApplicationCommand<{ guild?: GuildResolvable; }> | undefined> {
    if (interaction.guild) {
        await interaction.guild.commands.fetch();
        return interaction.guild.commands.cache.find((c) => c.name === specifiedCommand);
    }
    await interaction.client.application?.commands.fetch();
    return interaction.client.application?.commands.cache.find((c) => c.name === specifiedCommand);
}
