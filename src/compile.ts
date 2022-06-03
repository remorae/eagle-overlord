import { CompileLanguage } from './settings';
import { Message } from 'discord.js';
import { ErrorFunc } from './error';
import * as bent from 'bent';
import * as config from './config.json';

const maxCompileResultLength = 1900;

async function compile(source: string, language: CompileLanguage): Promise<{ error: unknown; output: unknown; statusCode: number; cpuTime: unknown; memory: unknown; }> {
    const request = bent('POST', 'json', 200);
    const body = await request(`https://api.jdoodle.com/v1/execute`, {
        script: source,
        language: language.id,
        versionIndex: language.index,
        clientId: config.jdoodle.id,
        clientSecret: config.jdoodle.token
    },
        {
            'content-type': `application/json`
        });
    return {
        error: body.error,
        output: body.output,
        statusCode: body.statusCode,
        cpuTime: body.cpuTime,
        memory: body.memory
    };
}

function escapeString(str: string): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const stripAnsi = require(`strip-ansi`);
    // eslint-disable-next-line no-control-regex
    let result = stripAnsi(str).replace(/[^\x00-\x7F]/g, ``).replace(/```/g, '\\`\\`\\`');
    if (result.length > maxCompileResultLength) {
        result = result.substr(0, maxCompileResultLength);
        result += `\n(...)`;
    }
    return result;
}

export async function doCompileCommand(message: Message, args: string[], reportError: ErrorFunc): Promise<void> {
    if (args.length === 0) {
        await message.channel.send(`Missing argument. See \`!help compile\` for more info.`);
        return;
    }
    if (args[0] === `langs`) {
        let msg = `Available languages:\n`;
        for (const lang of config.legacy.jdoodle.langs) {
            msg += `${lang.full}: ${lang.id}\n`;
        }
        await message.author.send(msg);
        return;
    }
    const language = config.legacy.jdoodle.langs.find(l => l.id === args[0]);
    if (!language) {
        await message.channel.send(`Invalid language. Use \`!compile langs\` to receive a PM with available languages.`);
        return;
    }
    const source = /```(\w+\n)?([\s\S]+)```/m.exec(args[1]);
    if (!source) {
        await message.channel.send(`Malformatted code. See \`!help compile\` for more info.`);
        return;
    }
    let input = source[2];
    if (!input) {
        await message.channel.send(`Malformatted code. See \`!help compile\` for more info.`);
        return;
    }
    input = input.replace(/```/g, ``);
    if (input.trim().length == 0) {
        await message.channel.send(`Input cannot be empty.`);
        return;
    }

    await message.channel.send(`Compiling ${language.full}...`);
    try {
        const results = await compile(input.replace(/```/g, ``), language);
        if (results.error) {
            await reportError(`Error: ${results.error}\nStatusCode: ${results.statusCode}`);
            await message.channel.send(`Go poke <@${config.client.developerUserId}>!`);
        } else if (results.output) {
            await message.channel.send(`Results for <@${message.author.id}>: \`\`\`${escapeString(results.output as string)}\`\`\`` +
                `\nMemory: ${results.memory}, CPU Time: ${results.cpuTime}`);
        } else if (results.statusCode !== 200) {
            await reportError(`Bad compile:\n${message.content}\n${JSON.stringify(results)}`);
        }
    }
    catch (error) {
        await reportError(error);
    }
}