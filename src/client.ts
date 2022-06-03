import { Client, Message, PartialMessage, User, PartialUser, MessageReaction, PartialMessageReaction, GuildMember, TextChannel, Interaction, Collection, ApplicationCommandPermissionData, Awaited } from 'discord.js';
import { handleCommand, handleNonCommand } from './commands';
import * as config from './config.json';
import { handleReaction } from './reactions';
import { welcome } from './welcome';
import { getCachedChannel, giveCaseWarning } from './utils';
import { Command, getCommandsOnDisk } from './client/command';
import { SlashCommandBuilder } from '@discordjs/builders';
import { findServer } from './settings';
import { EventEmitter } from 'node:events';

export interface ClientInstanceEvents {
    ready: [];
}

export class ClientInstance extends EventEmitter {
    public shouldRespond = true;
    private commands: Collection<string, Command> = new Collection()

    public constructor(public client: Client) {
        super();
        this.setupEvents();
    }

    public async setupCommands(this: ClientInstance): Promise<void> {
        this.commands.clear();
        for (const command of await getCommandsOnDisk()) {
            const builder = new SlashCommandBuilder();
            command.build(builder);
            this.commands.set(builder.name, command);
        }
        console.log(`Found ${this.commands.size} commands.`);
    }
    
    public on<K extends keyof ClientInstanceEvents>(event: K, listener: (...args: ClientInstanceEvents[K]) => Awaited<void>): this {
        return super.on(event, async (...args) => await listener(...args as ClientInstanceEvents[K]));
    }

    private setupEvents(this: ClientInstance) {
        this.client.on(`error`, async (error: Error) => await this.reportError(error, "`error` event"));
        this.client.on(`guildMemberAdd`, async (member: GuildMember) => await this.onGuildMemberAdd(member));
        this.client.on(`messageCreate`, async (message: Message) => await this.processMessage(message));
        this.client.on(`messageReactionAdd`, async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => await this.onReactionToggled(reaction, user, true));
        this.client.on(`messageReactionRemove`, async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => await this.onReactionToggled(reaction, user, false));
        this.client.on(`messageUpdate`, async (_oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
            try {
                await this.processMessage(await newMessage.fetch());
            }
            catch (error) {
                await this.reportError(error, "`messageUpdate` event");
            }
        });
        this.client.on(`interactionCreate`, async (interaction) => await this.handleInteraction(interaction))
        this.client.on(`ready`, async () => await this.onReady());
    }

    private async handleInteraction(this: ClientInstance, interaction: Interaction) {
        if (!interaction.isCommand()) {
            return;
        }
        if (!interaction.command) {
            return;
        }
        try {
            const command = this.commands.get(interaction.command.name);
            await command?.execute(interaction);
        }
        catch (e) {
            await this.reportError(e, "handleInteraction");
        }
    }

    private async onGuildMemberAdd(this: ClientInstance, member: GuildMember): Promise<void> {
        if (!this.shouldRespond) {
            return;
        }
        await welcome(member, async (msg) => await this.reportError(msg, "welcome"));
    }

    private async onReactionToggled(this: ClientInstance, reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, added: boolean): Promise<void> {
        if (!this.shouldRespond) {
            return;
        }
        try {
            const fullReaction = await reaction.fetch();
            const guild = fullReaction.message.guild;
            if (!guild || !guild.available)
                return;
            const fullUser = await user.fetch();
            const member = await guild.members.fetch(fullUser);
            handleReaction(fullReaction, member, added, (msg) => this.reportError(msg, "handleReaction"));
        }
        catch (err) {
            this.reportError(err, "onReactionToggled");
        }
    }

    private async setupServers(this: ClientInstance) {
        await this.client.guilds.fetch();
        for (const server of config.legacy.servers) {
            const guild = this.client.guilds.cache.get(server.id);
            if (!guild) {
                continue;
            }
            await guild.channels.fetch();
            for (const message of server.messagesToCache) {
                const channel = getCachedChannel(guild, message.channelID) as TextChannel;
                if (!channel) {
                    continue;
                }
                if (message.messageID.length > 0) {
                    try {
                        await channel.messages.fetch(message.messageID);
                    }
                    catch (err) {
                        this.reportError(err, "setupServers");
                    }
                }
            }
        }
    }

    private async setCommandPermissions(this: ClientInstance) {
        await this.client.guilds.fetch();
        for (const guild of this.client.guilds.cache.values()) {
            await guild.commands.fetch();
            await guild.roles.fetch();
            await guild.members.fetch();
            for (const [name, command] of this.commands) {
                const permissions: ApplicationCommandPermissionData[] = [];
                command.getPermissions(guild, permissions);
                const guildCommand = guild.commands.cache.find(c => c.applicationId == this.client.application?.id && c.name == name);
                await guildCommand?.permissions.set({ permissions });
            }
        }
    }

    private async onReady(this: ClientInstance) {
        console.log(`Setting up servers...`);
        await this.setupServers();
        console.log(`Setting command permissions...`);
        await this.setCommandPermissions();
        console.log(`Ready!`);
    }

    private async processMessage(this: ClientInstance, message: Message): Promise<void> {
        try {
            if (!this.shouldRespond) {
                return;
            }
            if (message.author.bot) {
                return;
            }

            const server = findServer(message.guild);
            const prefix = (server) ? server.commandPrefix : config.legacy.defaultCommandPrefix;

            if (!message.content.startsWith(prefix)) {
                await handleNonCommand(message);
                return;
            }

            const messageCommandText = message.content.split(' ')[0].substr(1);

            const commands = (server) ? server.commands : config.legacy.commands;
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

            await handleCommand(givenCommand, message, (err) => this.reportError(err, "handleCommand"));
        }
        catch (e) {
            this.reportError(e, "processMessage");
        }
    }

    public async reportError(this: ClientInstance, message: Error | string, context?: string): Promise<void> {
        if (message instanceof Error) {
            message = `${message.message}\n${message.stack}`;
        }
        if (context && context.length > 0) {
            message = `${message}\n"Context: ${context}`;
        }
        try {
            const creator = await this.client.users.fetch(config.legacy.botCreatorID);
            await creator.send(message as string);
        }
        catch (err) {
            console.error(message, err);
        }
    }
}