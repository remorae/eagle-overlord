import { Client, Message, User, MessageReaction, GuildMember, TextChannel } from 'discord.js';
import { handleCommand, handleNonCommand } from './commands';
import { ClientSettings } from './settings';
import { handleReaction } from './reactions';
import { welcome } from './welcome';
import { giveCaseWarning } from './utils';

export class ClientInstance {
    public shouldRespond: boolean = true;

    public constructor(public client: Client, private readonly settings: ClientSettings) {
        this.setupEvents();
    }

    private setupEvents(this: ClientInstance): void {
        this.client.on("error", (error: Error) => this.reportError(error));
        this.client.on("guildMemberAdd", (member: GuildMember) => this.onGuildMemberAdd(member));
        this.client.on("message", (message: Message) => this.processMessage(message));
        this.client.on("messageReactionAdd", (reaction: MessageReaction, user: User) => this.onReactionToggled(reaction, user, true));
        this.client.on("messageReactionRemove", (reaction: MessageReaction, user: User) => this.onReactionToggled(reaction, user, false));
        this.client.on("messageUpdate", (_oldMessage: Message, newMessage: Message) => this.processMessage(newMessage));
        this.client.on(`ready`, () => this.onReady());
    }

    private onGuildMemberAdd(this: ClientInstance, member: GuildMember): void {
        if (!this.shouldRespond) {
            return;
        }
        welcome(member, this.settings, (msg) => this.reportError(msg));
    }

    private onReactionToggled(this: ClientInstance, reaction: MessageReaction, user: User, added: boolean): void {
        if (!this.shouldRespond) {
            return;
        }
        const guild = reaction.message.guild;
        if (guild == null || !guild.available)
            return;

        guild.fetchMember(user)
            .then((member: GuildMember) => handleReaction(reaction, member, added, this.settings, (msg) => this.reportError(msg)))
            .catch((err) => this.reportError(err));
    }

    private setupServers(this: ClientInstance): void {
        console.log(`Setting up servers...`);
        for (const server of this.settings.servers) {
            const guild = this.client.guilds.get(server.id);
            if (!guild) {
                continue;
            }
            for (const message of server.messagesToCache) {
                const channel = guild.channels.get(message.channelID) as TextChannel;
                if (!channel) {
                    continue;
                }
                if (message.messageID.length > 0) {
                    channel.fetchMessage(message.messageID)
                        .catch((err) => this.reportError(err));
                }
            }
        }
    }

    private onReady(this: ClientInstance): void {
        this.setupServers();
        console.log(`Ready!`);
    }

    private processMessage(this: ClientInstance, message: Message): void {
        if (!this.shouldRespond) {
            return;
        }
        if (message.author.bot) {
            return;
        }

        const server = message.guild ? this.settings.servers.find(s => s.id == message.guild.id) : null;
        const prefix = (server) ? server.commandPrefix : this.settings.defaultCommandPrefix;

        if (!message.content.startsWith(prefix)) {
            handleNonCommand(message);
            return;
        }

        const messageCommandText = message.content.split(' ')[0].substr(1);

        const commands = (server) ? server.commands : this.settings.commands;
        const givenCommand = commands.find(c => c.symbol === messageCommandText);

        if (givenCommand == null) {
            // No valid command was found; check if the message didn't match casing
            for (const command of commands) {
                if (messageCommandText.toLowerCase() === `${command.symbol}`.toLowerCase()) {
                    giveCaseWarning(message, command.symbol);
                    break;
                }
            }
            return;
        }

        handleCommand(givenCommand, message, (err) => this.reportError(err), this.settings);
    }

    public reportError(this: ClientInstance, message: string | Error): void {
        if (message instanceof Error) {
            message = `${message.message}\n${message.stack}`;
        }
        this.client.fetchUser(this.settings.botCreatorID)
            .then((user: User) => {
                user.send(message)
                    .catch((err: Error) => {
                        console.error(message, err);
                    });
            })
            .catch((err: Error) => {
                console.error(message, err);
            });
    }
}