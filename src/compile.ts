import { CompileLanguage, ClientSettings } from "./settings";
import { Message } from "discord.js";

const request = require(`request`);
const stripAnsi = require(`strip-ansi`);

const maxCompileResultLength = 1900;

function compile(source: string, language: CompileLanguage, settings: ClientSettings,
    onSuccess: (result: { error: any; output: any; statusCode: any; cpuTime: any; memory: any; }) => void,
    reportError: (message: Error | string) => void): void {
    request.post({
        url: "https://api.jdoodle.com/v1/execute",
        json: {
            script: source,
            language: language.id,
            versionIndex: language.index,
            clientId: settings.jdoodle.id,
            clientSecret: settings.jdoodle.secret
        },
        headers: {
            "content-type": "application/json"
        }
    }, function (err: Error, _response: any, body: any) {
        if (err) {
            reportError(err);
            return;
        }
        onSuccess({
            error: body.error,
            output: body.output,
            statusCode: body.statusCode,
            cpuTime: body.cpuTime,
            memory: body.memory
        });
    })
}

function escapeString(str: string): string {
    let result = stripAnsi(str).replace(/[^\x00-\x7F]/g, "").replace(/```/g, "\\`\\`\\`");
    if (result.length > maxCompileResultLength) {
        result = result.substr(0, maxCompileResultLength);
        result += "\n(...)";
    }
    return result;
}

export function doCompileCommand(message: Message, args: string[], settings: ClientSettings, reportError: (message: Error | string) => void): void {
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
    const language = settings.jdoodle.langs.find(item => item.id === args[0]);
    if (language == null) {
        message.channel.send(`Invalid language. Use \`!compile langs\` to receive a PM with available languages.`);
        return;
    }
    const source = /```(\w+\n)?([\s\S]+)```/m.exec(args[1]);
    if (source == null) {
        message.channel.send(`\Malformatted code. See \`!help compile\` for more info.`);
        return;
    }

    message.channel.send(`Compiling ${language.full}...`);
    compile(source[2].replace(/```/g, ""), language, settings, (results) => {
        if (results.error != null) {
            reportError(`Error: ${results.error}\nStatusCode: ${results.statusCode}`);
            message.channel.send(`Go poke <@${settings.botCreatorID}>!`);
        } else if (results.output != null) {
            message.channel.send(`Results for <@${message.author.id}>: \`\`\`${escapeString(results.output)}\`\`\`` +
                `\nMemory: ${results.memory}, CPU Time: ${results.cpuTime}`);
        } else {
            reportError(`Bad compile:\n${message.content}\n${JSON.stringify(results)}`);
        }
    }, reportError);
}