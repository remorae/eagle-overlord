import { codeBlock, SlashCommandBuilder } from '@discordjs/builders';
import { AutocompleteFocusedOption, AutocompleteInteraction, CommandInteraction, Message, MessageActionRow, Modal, ModalActionRowComponent, ModalSubmitInteraction, TextInputComponent } from 'discord.js';
import { Command, MAX_CHOICES } from '../command.js';
import type { ClientInstance } from '../../client/client.js';
import config from '../../config.js';
import bent from 'bent';
// https://docs.jdoodle.com/compiler-api/compiler-api#what-languages-and-versions-are-supported
// https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md
import { languages as jdoodleLanguages } from './languages.json'; 
import { escapeCodeBlocks } from '../utils.js';
import { showTimedModal } from '../modal.js';

class CompileCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('compile')
            .setDescription('Compile code.')
            .setDMPermission(true)
            .addSubcommand((command) =>
                command
                    .setName('languages')
                    .setDescription('List available languages.')
            )
            .addSubcommand((command) =>
                command
                    .setName('run')
                    .setDescription('Compile and run the provided code.')
                    .addStringOption((option) =>
                        option
                            .setName('language')
                            .setDescription('Which language the code is written in.')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addIntegerOption((option) =>
                        option
                            .setName('version')
                            .setDescription('Which compiler/language version to use.')
                            .setAutocomplete(true)
                    )
            );
    }
    async execute(interaction: CommandInteraction, client: ClientInstance) {
        const subcommand = interaction.options.getSubcommand(true);
        switch (subcommand) {
            case 'languages':
                await listLanguages(interaction);
                break;
            case 'run':
                await handleRunCommand(interaction, client);
                break;
            default:
                await interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
                break;
        }
    }
    async autocomplete(interaction: AutocompleteInteraction, _client: ClientInstance) {
        const focusedOption = interaction.options.getFocused(true);
        switch (focusedOption.name) {
            case 'language':
                await autocompleteLanguage(interaction, focusedOption);
                break;
            case 'version': {
                await autocompleteVersion(interaction);
                break;
            }
            default:
                await interaction.respond([]);
                break;
        }
    }
}

export const command: Command = new CompileCommand();

async function autocompleteVersion(interaction: AutocompleteInteraction) {
    const langId = interaction.options.getString('language');
    const lang = jdoodleLanguages.find((l) => l.id === langId);
    if (lang) {
        const versionChoices = Array.from({ length: lang.index + 1 }, (_, i) => ({ name: i.toString(), value: i }))
            .slice(0, MAX_CHOICES);
        await interaction.respond(versionChoices);
    }
    else {
        await interaction.respond([]);
    }
}

async function autocompleteLanguage(interaction: AutocompleteInteraction, focusedOption: AutocompleteFocusedOption) {
    const languageChoices = jdoodleLanguages
        .filter((lang) => focusedOption.value.length === 0 || lang.full.startsWith(focusedOption.value))
        .slice(0, MAX_CHOICES)
        .map((lang) => ({ name: lang.full, value: lang.id }));
    await interaction.respond(languageChoices);
}

async function listLanguages(interaction: CommandInteraction) {
    const langs = jdoodleLanguages.map((lang) => `${lang.full}: ${lang.id}`);
    const msg =
`Available languages:
${langs.join('\n')}`;
    await interaction.reply({ content: msg, ephemeral: true });
}

interface CompileLanguage {
    id: string;
    full: string;
    index: number;
    alias?: string;
}

async function handleRunCommand(interaction: CommandInteraction, client: ClientInstance) {
    const language = interaction.options.get('language', true).value as string;
    const validLang = jdoodleLanguages.find(lang => lang.id === language);
    const version = (interaction.options.get('version')?.value as number) ?? validLang?.index;
    if (validLang) {
        await askForRunInput(interaction, client, validLang, version);
    }
    else {
        await interaction.reply({ content: 'Invalid language.', ephemeral: true });
    }
}

async function askForRunInput(interaction: CommandInteraction, client: ClientInstance, validLang: CompileLanguage, version: number) {
    const modal = buildRunModal(validLang);
    const submission = await showTimedModal(interaction, modal);
    if (submission) {
        await processRunInput(submission, client, validLang, version);
    }
}

function buildRunModal(validLang: CompileLanguage) {
    return new Modal()
        .setCustomId('compileRunModal')
        .setTitle(`Compile ${validLang.full}`)
        .addComponents(
            new MessageActionRow<ModalActionRowComponent>()
                .addComponents(
                    new TextInputComponent()
                        .setCustomId('input')
                        .setLabel('Input')
                        .setPlaceholder('Please enter some code to compile...')
                        .setStyle('PARAGRAPH')
                        .setRequired(true)
                )
        );
}

async function processRunInput(interaction: ModalSubmitInteraction, client: ClientInstance, validLang: CompileLanguage, version: number) {
    const input = escapeCodeBlocks(interaction.fields.getTextInputValue('input').trim());
    if (input && input.length > 0) {
        await runCompilation(interaction, client, validLang, input, version);
    }
    else {
        await interaction.followUp({ content: 'Input cannot be empty.', ephemeral: true });
    }
}

async function runCompilation(interaction: ModalSubmitInteraction, client: ClientInstance, lang: CompileLanguage, input: string, version: number) {
    const msg = `Compiling ${lang.full}...${lang.alias ? codeBlock(lang.alias, input) : codeBlock(input)}`;
    const reply = await interaction.followUp({ content: msg }) as Message;
    try {
        const result = await requestCompile(input, lang, version);
        await processCompileResult(client, result, reply);
    }
    catch (error) {
        client.reportError(error);
        await reply.reply({ content: 'Something went wrong!' });
    }
}

interface CompileSuccess {
    output: string;
    statusCode: number;
    memory: number;
    cpuTime: number;
}

interface CompileFailure {
    error: string;
    statusCode: number;
}

type CompileResult = CompileSuccess | CompileFailure;

async function requestCompile(source: string, language: CompileLanguage, version: number): Promise<CompileResult> {
    const request = bent('POST', 'json', StatusCodes.OK);
    const response = await request(
        'https://api.jdoodle.com/v1/execute',
        {
            script: source,
            language: language.id,
            versionIndex: version,
            clientId: config.jdoodle.id,
            clientSecret: config.jdoodle.token
        },
        {
            'content-type': 'application/json'
        }
    );
    return response;
}

async function processCompileResult(client: ClientInstance, result: CompileResult, reply: Message) {
    if ('error' in result) {
        const msg = `Server responded with error: ${codeBlock(result.error)}Status code: ${result.statusCode}.`;
        await client.reportError(msg, 'replyToCompile');
        await reply.reply({ content: msg });
    }
    else {
        const output = escapeCodeBlocks(truncateString(result.output));
        const msg = `Results: ${codeBlock(output)}Memory: ${result.memory}, CPU Time: ${result.cpuTime}`;
        await reply.reply({ content: msg });
    }
}

function truncateString(str: string): string {
    const maxCompileResultLength = 1900;
    if (str.length > maxCompileResultLength) {
        return `${str.slice(0, maxCompileResultLength)  }\n(...)`;
    }
    return str;
}