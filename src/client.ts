import { Client, Message, PartialMessage, User, PartialUser, MessageReaction, PartialMessageReaction, GuildMember, TextChannel, Interaction, Collection, ApplicationCommandPermissionData } from 'discord.js';
import { handleCommand, handleNonCommand } from './commands';
import * as config from './config.json';
import { handleReaction } from './reactions';
import { welcome } from './welcome';
import { getCachedChannel, giveCaseWarning } from './utils';
import { Command } from './client/command';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as fs from 'fs';
import * as path from 'path';
import { findServer } from './settings';

export class ClientInstance {
    public shouldRespond = true;
    private commands: Collection<string, Command> = new Collection()

    public constructor(public client: Client) {
        this.setupEvents();
    }

    public async setupCommands(this: ClientInstance): Promise<void> {
        this.commands.clear();
        const commandsDir = path.resolve(path.dirname(require.main!.filename), 'client', 'commands');
        const commandFiles = (await fs.promises.readdir(commandsDir)).filter((file: string) => file.endsWith('.js'));
        for (const file of commandFiles) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const command = require(path.resolve(commandsDir, file)).command as Command;
            const builder = new SlashCommandBuilder();
            command.build(builder);
            this.commands.set(builder.name, command);
        }
        console.log(`Found ${this.commands.size} commands.`);
    }

    private setupEvents(this: ClientInstance) {
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
        this.client.on(`interactionCreate`, async (interaction) => await this.handleInteraction(interaction))
        this.client.on(`ready`, () => this.onReady());
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
            this.reportError(e, "handleInteraction");
        }
    }

    private onGuildMemberAdd(this: ClientInstance, member: GuildMember): void {
        if (!this.shouldRespond) {
            return;
        }
        welcome(member, (msg) => this.reportError(msg, "welcome"));
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
                .then((member: GuildMember) => handleReaction(fullReaction, member, added, (msg) => this.reportError(msg, "handleReaction")))
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
                    channel.messages.fetch(message.messageID)
                        .catch((err) => this.reportError(err, "setupServers"));
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

    private processMessage(this: ClientInstance, message: Message): void {
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
                handleNonCommand(message);
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

            handleCommand(givenCommand, message, (err) => this.reportError(err, "handleCommand"));
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
        this.client.users.fetch(config.legacy.botCreatorID)
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