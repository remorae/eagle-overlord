import { Client, Message, PartialMessage, User, PartialUser, MessageReaction, PartialMessageReaction, GuildMember, TextChannel } from 'discord.js';
import { handleCommand, handleNonCommand } from './commands';
import { ClientSettings } from './settings';
import { handleReaction } from './reactions';
import { welcome } from './welcome';
import { getCachedChannel, giveCaseWarning } from './utils';

export class ClientInstance {
    public shouldRespond: boolean = true;

    public constructor(public client: Client, private readonly settings: ClientSettings) {
        this.setupEvents();
    }

    private setupEvents(this: ClientInstance): void {
        this.client.on(`error`, (error: Error) => this.reportError(error, "`error` event"));
        this.client.on(`guildMemberAdd`, (member: GuildMember) => this.onGuildMemberAdd(member));
        this.client.on(`messageCreate`, (message: Message) => this.processMessage(message));
        this.client.on(`messageReactionAdd`, (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => this.onReactionToggled(reaction, user, true));
        this.client.on(`messageReactionRemove`, (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => this.onReactionToggled(reaction, user, false));
        this.client.on(`messageUpdate`, (_oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
            if (newMessage.partial) {
                newMessage.fetch()
                    .then(this.processMessage)
                    .catch((error) => this.reportError(error, "`messageUpdate` event"));
            }
            else {
                this.processMessage(newMessage);
            }
        });
        this.client.on(`ready`, () => this.onReady());
    }

    private onGuildMemberAdd(this: ClientInstance, member: GuildMember): void {
        if (!this.shouldRespond) {
            return;
        }
        welcome(member, this.settings, (msg) => this.reportError(msg, "welcome"));
    }

    private onReactionToggled(this: ClientInstance, reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, added: boolean): void {
        if (!this.shouldRespond) {
            return;
        }
        const useReaction = (fullReaction: MessageReaction) => {
            const guild = fullReaction.message.guild;
            if (!guild || !guild.available)
                return;

            const useUser = (fullUser: User) => guild.members.fetch(fullUser)
                .then((member: GuildMember) => handleReaction(fullReaction, member, added, this.settings, (msg) => this.reportError(msg, "handleReaction")))
                .catch((err) => this.reportError(err, "onReactionToggled"));
            if (user.partial) {
                user.fetch()
                .then(useUser)
                .catch((error) => this.reportError(error, "onReactionToggled"))
            }
            else {
                useUser(user);
            }
        };
        if (reaction.partial) {
            reaction.fetch()
            .then(useReaction)
            .catch((error) => this.reportError(error, "onReactionToggled"));
        }
        else {
            useReaction(reaction);
        }
    }

    private setupServers(this: ClientInstance): void {
        console.log(`Setting up servers...`);
        this.client.guilds.fetch().then(() => {
            for (const server of this.settings.servers) {
                const guild = this.client.guilds.cache.get(server.id);
                if (!guild) {
                    continue;
                }
                guild.channels.fetch().then(() => {
                    for (const message of server.messagesToCache) {
                        const channel = getCachedChannel(guild, message.channelID) as TextChannel;
                        if (!channel) {
                            continue;
                        }
                        if (message.messageID.length > 0) {
                            channel.messages.fetch(message.messageID)
                                .catch((err) => this.reportError(err, "setupServers"));
                        }
                    }
                });
            }
        });
    }

    private onReady(this: ClientInstance): void {
        this.setupServers();
        console.log(`Ready!`);
    }

    private processMessage(this: ClientInstance, message: Message): void {
        try {
            if (!this.shouldRespond) {
                return;
            }
            if (message.author.bot) {
                return;
            }

            const server = message.guild
                ? this.settings.servers.find(s => s.id == message.guild?.id)
                : null;
            const prefix = (server) ? server.commandPrefix : this.settings.defaultCommandPrefix;

            if (!message.content.startsWith(prefix)) {
                handleNonCommand(message);
                return;
            }

            const messageCommandText = message.content.split(' ')[0].substr(1);

            const commands = (server) ? server.commands : this.settings.commands;
            const givenCommand = commands.find(c => c.symbol === messageCommandText);

            if (!givenCommand) {
                // No valid command was found; check if the message didn't match casing
                for (const command of commands) {
                    if (messageCommandText.toLowerCase() === `${command.symbol}`.toLowerCase()) {
                        giveCaseWarning(message, command.symbol);
                        break;
                    }
                }
                return;
            }

            handleCommand(givenCommand, message, (err) => this.reportError(err, "handleCommand"), this.settings);
        }
        catch (e) {
            this.reportError(e, "processMessage");
        }
    }

    public reportError(this: ClientInstance, message: Error | string, context?: string): void {
        if (message instanceof Error) {
            message = `${message.message}\n${message.stack}`;
        }
        if (context && context.length > 0) {
            message = `${message}\n"Context: ${context}`;
        }
        this.client.users.fetch(this.settings.botCreatorID)
            .then((user: User) => {
                user.send(message as string)
                    .catch((err: Error) => {
                        console.error(message, err);
                    });
            })
            .catch((err: Error) => {
                console.error(message, err);
            });
    }
}