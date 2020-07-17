import { CompileLanguage, ClientSettings } from './settings';
import { Message } from 'discord.js';
import { ErrorFunc } from './error';

const bent = require(`bent`);
const stripAnsi = require(`strip-ansi`);

const maxCompileResultLength = 1900;

async function compile(source: string, language: CompileLanguage, settings: ClientSettings,
    onSuccess: (result: { error: any; output: any; statusCode: number; cpuTime: any; memory: any; }) => void,
    reportError: ErrorFunc): Promise<void> {
    try {
        const request = bent('POST', 'json', 200);
        const body = await request(`https://api.jdoodle.com/v1/execute`, {
                script: source,
                language: language.id,
                versionIndex: language.index,
                clientId: settings.jdoodle.id,
                clientSecret: settings.jdoodle.secret
            },
            {
                'content-type': `application/json`
        });
        onSuccess({
            error: body.error,
            output: body.output,
            statusCode: body.statusCode,
            cpuTime: body.cpuTime,
            memory: body.memory
        });
    } catch (e) {
        reportError(e);
    }
}

function escapeString(str: string): string {
    let result = stripAnsi(str).replace(/[^\x00-\x7F]/g, ``).replace(/```/g, '\\`\\`\\`');
    if (result.length > maxCompileResultLength) {
        result = result.substr(0, maxCompileResultLength);
        result += `\n(...)`;
    }
    return result;
}

export function doCompileCommand(message: Message, args: string[],
    settings: ClientSettings, reportError: ErrorFunc): void {
    if (args.length === 0) {
        message.channel.send(`Missing argument. See \`!help compile\` for more info.`);
        return;
    }
    if (args[0] === `langs`) {
        let msg = `Available languages:\n`;
        for (const lang of settings.jdoodle.langs) {
            msg += `${lang.full}: ${lang.id}\n`;
        }
        message.author.send(msg);
        return;
    }
    const language = settings.jdoodle.langs.find(l => l.id === args[0]);
    if (!language) {
        message.channel.send(`Invalid language. Use \`!compile langs\` to receive a PM with available languages.`);
        return;
    }
    const source = /```(\w+\n)?([\s\S]+)```/m.exec(args[1]);
    if (!source) {
        message.channel.send(`Malformatted code. See \`!help compile\` for more info.`);
        return;
    }
    let input = source[2];
    if (!input) {
        message.channel.send(`Malformatted code. See \`!help compile\` for more info.`);
        return;
    }
    input = input.replace(/```/g, ``);
    if (input.trim().length == 0) {
        message.channel.send(`Input cannot be empty.`);
        return;
    }

    message.channel.send(`Compiling ${language.full}...`);
    compile(input.replace(/```/g, ``), language, settings, (results) => {
        if (results.error) {
            reportError(`Error: ${results.error}\nStatusCode: ${results.statusCode}`);
            message.channel.send(`Go poke <@${settings.botCreatorID}>!`);
        } else if (results.output) {
            message.channel.send(`Results for <@${message.author.id}>: \`\`\`${escapeString(results.output)}\`\`\`` +
                `\nMemory: ${results.memory}, CPU Time: ${results.cpuTime}`);
        } else if (results.statusCode !== 200) {
            reportError(`Bad compile:\n${message.content}\n${JSON.stringify(results)}`);
        }
    }, reportError);
}