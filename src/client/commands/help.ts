import { SlashCommandBuilder } from '@discordjs/builders';
import type { ApplicationCommand, ApplicationCommandPermissionData, CommandInteraction, Guild, GuildResolvable } from 'discord.js';
import type { ClientInstance } from '../../client.js';
import { Command, getCommandsOnDisk } from '../command.js';

class HelpCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        const otherCommands = (await getCommandsOnDisk(false)).filter(c => !(c instanceof HelpCommand));
        builder
            .setName('help')
            .setDescription('Displays helpful information about command usage.')
            .addStringOption((option) =>
                option
                    .setName('command')
                    .setDescription('The command to get information about.')
                    .addChoices(...otherCommands.map(command => {
                        const builder = new SlashCommandBuilder();
                        command.build(builder);
                        return { name: builder.name, value: builder.name };
                    }))
            );
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async getPermissions(_guild: Guild, _permissions: ApplicationCommandPermissionData[]): Promise<void> {
    }
    async execute(interaction: CommandInteraction, client: ClientInstance): Promise<void> {
        const specifiedCommand = interaction.options.getString('command', false);
        if (!specifiedCommand) {
            await sendGeneralHelp(interaction);
        }
        else {
            const command = await getDeployedCommand(interaction, specifiedCommand);
            if (command) {
                await sendCommandHelp(command, interaction, client);
            }
            else {
                await interaction.reply({ content: 'Unrecognized command. Slash commands may still be deploying.', ephemeral: true });
            }
        }
    }
}

export const command: Command = new HelpCommand();

function getRequiredOptions(command: ApplicationCommand, client: ClientInstance): string[] {
    const cachedCommand = client.getCachedCommands().get(command.name);
    const builder = (cachedCommand) ? new SlashCommandBuilder() : undefined;
    if (builder) {
        cachedCommand?.build(builder);
    }
    const builtOptions = builder?.options.map((o) => o.toJSON());
    return command.options.map(o => o.name).filter((name) => {
        const deployedOption = builtOptions?.find((o) => o.name == name);
        if (!deployedOption) {
            client.reportError(`Couldn't find deployed option with name: ${name}`, 'getRequiredOptions');
        }
        return deployedOption?.required;
    });
}

async function sendCommandHelp(command: ApplicationCommand<{ guild?: GuildResolvable; }>, interaction: CommandInteraction, client: ClientInstance): Promise<void> {
    const requiredOptions = getRequiredOptions(command, client);
    let usage = `\`/${command.name}`;
    for (const option of command.options) {
        usage += ` ${(requiredOptions.includes(option.name)) ? `<${option.name}>` : `[${option.name}]`}`;
    }
    usage += '`';
    for (const option of command.options) {
        usage += `\n\`${option.name}\`: ${requiredOptions.includes(option.name) ? 'Required' : 'Optional'}. ${option.description}`;
    }
    await interaction.reply({ content: `Usage: ${usage}\nInfo: ${command.description}`, ephemeral: true });
}

async function sendGeneralHelp(interaction: CommandInteraction): Promise<void> {
    const helpChannel = interaction.guild?.channels.cache.get('273687752392966155');
    await interaction.reply({
        content: 'If you\'d like help with specific command syntax, please use `/help <commandName>`.' +
            '\nIf you\'d like to see available commands, please use `/commands`.' +
            (helpChannel ? `\nIf you need help with Discord or something not specific to a class, please ask a question in ${helpChannel}.` : '')
    });
}

async function getDeployedCommand(interaction: CommandInteraction, specifiedCommand: string): Promise<ApplicationCommand<{ guild?: GuildResolvable; }> | undefined> {
    if (interaction.guild) {
        await interaction.guild.commands.fetch();
        return interaction.guild.commands.cache.find((c) => c.name == specifiedCommand);
    }
    await interaction.client.application?.commands.fetch();
    return interaction.client.application?.commands.cache.find((c) => c.name == specifiedCommand);
}
