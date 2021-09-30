import { Message } from 'discord.js';
import { ClientSettings, findServer } from './settings';
import { getCachedChannel, giveCaseWarning } from './utils'

export function displayHelpMessage(message: Message, args: string[],
    settings: ClientSettings): void {
    const server = findServer(settings, message.guild);
    if (args.length === 0) {
        const helpChannel = (server) ? getCachedChannel(message.guild!, server.helpChannel) : null;
        message.channel.send(`If you'd like help with specific command syntax, please use \`!help <commandName>\`.` +
            `\nIf you'd like to see available commands, please use \`!commands\`.` +
            (helpChannel ? `\nIf you need help with Discord or something not specific to a class, please ask a question in ${helpChannel}.` : ``));
    } else {
        const commandArg = args[0];
        const commands = server ? server.commands : settings.commands;
        for (const command of commands) {
            if (commandArg.toLowerCase() === `${command.symbol}`.toLowerCase()) {
                if (commandArg === command.symbol) {
                    message.channel.send(`Usage: ${command.usage}\nInfo: ${command.info}`);
                } else {
                    giveCaseWarning(message, command.symbol);
                }
                return;
            }
        }
        message.channel.send(`Unrecognized command. See !help for more information or !commands for a list of valid commands.`);
    }
}