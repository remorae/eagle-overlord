import { codeBlock, SlashCommandBuilder } from '@discordjs/builders';
import type { AutocompleteFocusedOption, AutocompleteInteraction, CommandInteraction } from 'discord.js';
import type { Command } from '../command.js';
import type { ClientInstance } from '../../client.js';
import config from '../../config.js';
import bent from 'bent';
// https://docs.jdoodle.com/compiler-api/compiler-api#what-languages-and-versions-are-supported
// https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md
import { languages as jdoodleLanguages } from './languages.json'; 

class CompileCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('compile')
            .setDescription('Compile code.')
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
                    .addStringOption((option) =>
                        option
                            .setName('code')
                            .setDescription('The code to compile.')
                            .setRequired(true)
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

const maxChoices = 25;

async function autocompleteVersion(interaction: AutocompleteInteraction) {
    const langId = interaction.options.getString('language');
    const lang = jdoodleLanguages.find((l) => l.id === langId);
    if (lang) {
        const versionChoices = Array.from({ length: lang.index + 1 }, (_, i) => ({ name: i.toString(), value: i }))
            .slice(0, maxChoices);
        await interaction.respond(versionChoices);
    }
    else {
        await interaction.respond([]);
    }
}

async function autocompleteLanguage(interaction: AutocompleteInteraction, focusedOption: AutocompleteFocusedOption) {
    const languageChoices = jdoodleLanguages
        .filter((lang) => lang.id.startsWith(focusedOption.value))
        .slice(0, maxChoices)
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

async function handleRunCommand(interaction: CommandInteraction, client: ClientInstance) {
    const language = interaction.options.getString('language', true);
    const validLang = jdoodleLanguages.find(lang => lang.id === language);
    if (validLang) {
        const code = interaction.options.getString('code', true).trim();
        if (code.length > 0) {
            await runCompilation(interaction, client, validLang, code);
        }
        else {
            await interaction.reply({ content: 'Input cannot be empty.', ephemeral: true });
        }
    }
    else {
        await interaction.reply({ content: 'Invalid language.', ephemeral: true });
    }
}

async function runCompilation(interaction: CommandInteraction, client: ClientInstance, lang: CompileLanguage, code: string) {
    const msg =
`Compiling ${lang.full}...
${lang.alias ? codeBlock(lang.alias, code) : codeBlock(code)}`;
    await interaction.reply({ content: msg });
    try {
        const result = await requestCompile(code, lang);
        await replyToCompile(interaction, client, result);
    }
    catch (error) {
        await client.reportError(error, 'runCompilation');
        await interaction.followUp({ content: 'Something went wrong!' });
    }
}

interface CompileLanguage {
    id: string;
    full: string;
    index: number;
    alias?: string;
}

interface CompileResult {
    error?: string;
    output?: string;
    statusCode?: number;
    cpuTime?: number;
    memory?: number;
}

async function replyToCompile(interaction: CommandInteraction, client: ClientInstance, result: CompileResult) {
    if (result.error) {
        const msg = `Server responded with error: ${result.error}, status code: ${result.statusCode}.`;
        await client.reportError(msg, 'replyToCompile');
        await interaction.followUp({ content: msg });
    }
    else if (result.output) {
        const escaped = truncateString(result.output)
            .replaceAll('```', '\\`\\`\\`');
        const msg =
`Results: ${codeBlock(escaped)}
Memory: ${result.memory}, CPU Time: ${result.cpuTime}`;
        await interaction.followUp({
            content: msg
        });
    }
    else if (result.statusCode !== StatusCodes.ok) {
        const msg =
`Compilation failed. Server responded with status code ${result.statusCode}:
${JSON.stringify(result)}`;
        await client.reportError(msg, 'replyToCompile');
        await interaction.followUp({ content: msg });
    }
}

async function requestCompile(source: string, language: CompileLanguage): Promise<CompileResult> {
    const request = bent('POST', 'json', StatusCodes.ok);
    const response = await request('https://api.jdoodle.com/v1/execute', {
        script: source,
        language: language.id,
        versionIndex: language.index,
        clientId: config.jdoodle.id,
        clientSecret: config.jdoodle.token
    },
    {
        'content-type': 'application/json'
    });
    return response;
}

function truncateString(str: string): string {
    const maxCompileResultLength = 1900;
    if (str.length > maxCompileResultLength) {
        return `${str.slice(0, maxCompileResultLength)  }\n(...)`;
    }
    return str;
}