import { Message } from "discord.js";
import { ClientSettings } from "./settings";
import { giveCaseWarning } from "./utils"

export function displayHelpMessage(message: Message, args: string[], settings: ClientSettings): void {
    const server = message.guild ? settings.servers.find(s => s.id == message.guild.id) : null;
    if (args.length === 0) {
        const helpChannel = (server) ? message.guild.channels.get(server.helpChannel) : null;
        message.channel.send(`If you'd like help with specific command syntax, please use \`!help <commandName>\`.` +
            `\nIf you'd like to see available commands, please use \`!commands\`.` +
            ((helpChannel != null) ? `\nIf you need help with Discord or something not specific to a class, please ask a question in ${helpChannel}.` : ``));
    } else {
        const commandArg = args[0];
        const commands = server ? server.commands : settings.commands;
        for (const command of commands) {
            if (commandArg.toLowerCase() === `${command.symbol}`.toLowerCase()) {
                if (commandArg === command.symbol) {
                    message.channel.send(`Usage: ` + command.usage + "\nInfo: " + command.info);
                } else {
                    giveCaseWarning(message, command.symbol);
                }
                return;
            }
        }
        message.channel.send(`Unrecognized command. See !help for more information or !commands for a list of valid commands.`);
    }
}