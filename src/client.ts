import { Command, getCommandsOnDisk } from './client/command.js';
import { handleCommand, handleNonCommand } from './commands.js';
import config from './config.js';
import { handleReaction } from './reactions.js';
import { findServer } from './settings.js';
import type { Terminal } from './terminal.js';
import { getCachedChannel, giveCaseWarning } from './utils.js';
import { welcome } from './client/commands/welcome.js';

import { Client, Message, PartialMessage, User, PartialUser, MessageReaction, PartialMessageReaction, GuildMember, TextChannel, Interaction, Collection, ApplicationCommandPermissionData, CommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { EventEmitter } from 'node:events';

export interface ClientInstanceEvents {
    ready: [];
}

export class ClientInstance extends EventEmitter {
    public shouldRespond = true;
    private commands: Collection<string, Command> = new Collection();
    private rest = new REST({ version: '9' }).setToken(config.client.token);
    public terminal: Terminal | null = null;

    public constructor(public client: Client) {
        super();
        this.setupEvents();
    }

    public async setupCommands(this: ClientInstance): Promise<void> {
        this.commands.clear();
        for (const command of await getCommandsOnDisk()) {
            const builder = new SlashCommandBuilder();
            await command.build(builder);
            this.commands.set(builder.name, command);
        }
        console.log(`Found ${this.commands.size} commands.`);
    }

    public getCachedCommands(this: ClientInstance): Collection<string, Command> {
        return this.commands;
    }

    public async deployCommands(this: ClientInstance, global = false) {
        try {
            // Global commands are cached; only guaranteed to be up-to-date after an hour
            const route = (global) ? Routes.applicationCommands(config.client.id) : Routes.applicationGuildCommands(config.client.id, config.client.devGuildId);
            await this.rest.put(
                route,
                {
                    body: await Promise.all(this.commands.map(async (command) => {
                        const builder = new SlashCommandBuilder();
                        await command.build(builder);
                        return builder.toJSON();
                    }))
                },
            );
        }
        catch (err) {
            this.reportError(err, 'pushCommands');
        }
    }

    public async setCommandPermissions(this: ClientInstance) {
        /* TODO Discord API prevents permissions.set from working w/o bearer token instead of bot token.
            No Discord.js API for setting default command permissions yet (which would be sufficient for current use cases)
            https://github.com/discordjs/discord.js/issues/7856
            https://discord.com/developers/docs/topics/oauth2#client-credentials-grant
            https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-using-default-permissions
        */

        // await this.client.guilds.fetch();
        // for (const guild of this.client.guilds.cache.values()) {
        //     await guild.commands.fetch();
        //     await guild.roles.fetch();
        //     await guild.members.fetch();
        //     for (const [name, command] of this.commands) {
        //         const permissions: ApplicationCommandPermissionData[] = [];
        //         await command.getPermissions(guild, permissions);
        //         if (permissions.length == 0) {
        //             continue;
        //         }
        //         const guildCommand = guild.commands.cache.find(c => c.applicationId == this.client.application?.id && c.name == name);
        //         await guildCommand?.permissions.set({ permissions });
        //     }
        // }
    }

    public async reportError(this: ClientInstance, message: Error | string | unknown, context?: string): Promise<void> {
        if (message instanceof Error) {
            message = `${message.message}\n${message.stack}`;
        }
        if (context && context.length > 0) {
            message = `${message}\n"Context: ${context}`;
        }
        try {
            const creator = await this.client.users.fetch(config.client.developerUserId);
            await creator.send(`${message}`);
            console.error(message);
            this.terminal?.prompt();
        }
        catch (err) {
            console.error(message, err);
            this.terminal?.prompt();
        }
    }

    private setupEvents(this: ClientInstance) {
        this.client.on('error', async (error: Error) => await this.reportError(error, '`error` event'));
        this.client.on('guildMemberAdd', async (member: GuildMember) => await this.onGuildMemberAdd(member));
        this.client.on('messageCreate', async (message: Message) => await this.processMessage(message));
        this.client.on('messageReactionAdd', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => await this.onReactionToggled(reaction, user, true));
        this.client.on('messageReactionRemove', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => await this.onReactionToggled(reaction, user, false));
        this.client.on('messageUpdate', async (_oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
            try {
                if (newMessage.author?.bot) {
                    return;
                }
                await this.processMessage(await newMessage.fetch());
            }
            catch (error) {
                await this.reportError(error, '`messageUpdate` event');
            }
        });
        this.client.on('interactionCreate', async (interaction) => await this.handleInteraction(interaction));
        this.client.on('ready', async () => await this.onReady());
    }

    private async allowInteraction(interaction: CommandInteraction, command: Command): Promise<boolean> {
        if (interaction.guild) {
            const permissions: ApplicationCommandPermissionData[] = [];
            await command.getPermissions(interaction.guild, permissions);
            return Promise.resolve(permissions.some((perm) => {
                switch (perm.type) {
                    case 'ROLE':
                        if (!(interaction.member instanceof GuildMember) || !interaction.guild) {
                            return false;
                        }
                        return interaction.member.roles.cache.has(perm.id);
                    case 'USER':
                        return interaction.user.id == perm.id;
                }
                return false;
            }));
        }
        return Promise.resolve(true);
    }

    private async handleInteraction(this: ClientInstance, interaction: Interaction) {
        if (!interaction.isCommand()) {
            return;
        }
        try {
            const command = this.commands.get(interaction.commandName);
            if (command && !this.allowInteraction(interaction, command)) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }
            if (interaction.guild) {
                const permissions: ApplicationCommandPermissionData[] = [];
                await command?.getPermissions(interaction.guild, permissions);
            }
            await command?.execute(interaction, this);
        }
        catch (e) {
            await this.reportError(e, 'handleInteraction');
        }
    }

    private async onGuildMemberAdd(this: ClientInstance, member: GuildMember): Promise<void> {
        if (!this.shouldRespond) {
            return;
        }
        await welcome(member, async (msg) => await this.reportError(msg, 'onGuildMemberAdd'));
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
            handleReaction(fullReaction, member, added, (msg) => this.reportError(msg, 'handleReaction'));
        }
        catch (err) {
            this.reportError(err, 'onReactionToggled');
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
                        this.reportError(err, 'setupServers');
                    }
                }
            }
        }
    }

    private async onReady(this: ClientInstance) {
        console.log('Setting up servers...');
        await this.setupServers();
        console.log('Pushing commands to Discord (dev guild)...');
        await this.deployCommands();
        console.log('Setting command permissions...');
        await this.setCommandPermissions();
        console.log('Ready!');
        this.terminal?.prompt();
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

            const messageCommandText = message.content.slice(1, message.content.indexOf(' '));

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

            await handleCommand(givenCommand, message, (err) => this.reportError(err, 'handleCommand'));
        }
        catch (e) {
            this.reportError(e, 'processMessage');
        }
    }
}