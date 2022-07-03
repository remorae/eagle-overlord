import { Command, getCommandsOnDisk } from './client/command.js';
import { handleCommand, handleNonCommand } from './commands.js';
import config from './config.js';
import { handleReaction } from './reactions.js';
import { CommandSettings, findServer } from './settings.js';
import type { Terminal } from './terminal.js';
import { getCachedChannel } from './utils.js';
import { welcome } from './client/commands/welcome.js';

import { Client, Message, PartialMessage, User, PartialUser, MessageReaction, PartialMessageReaction, GuildMember, TextChannel, Interaction, Collection, ApplicationCommandPermissionData, CommandInteraction, AutocompleteInteraction } from 'discord.js';
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
        const readCommands = await getCommandsOnDisk();
        const builtCommands = await Promise.all(
            readCommands
                .map(async (command) => {
                    const builder = new SlashCommandBuilder();
                    await command.build(builder);
                    return { builder, command };
                }));
        for (const { builder, command } of builtCommands) {
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

    public async reportError(this: ClientInstance, reason: Error | string | unknown, context?: string): Promise<void> {
        let message = ''; 
        if (reason instanceof Error) {
            message = `${reason.message}\n${reason.stack}`;
        }
        if (context && context.length > 0) {
            message = `${message}\n"Context: ${context}`;
        }
        try {
            await this.reportErrorViaDiscord(message);
        }
        catch (err) {
            console.error(message, err);
            this.terminal?.prompt();
        }
    }

    private async reportErrorViaDiscord(message: string) {
        const creator = await this.client.users.fetch(config.client.developerUserId);
        await creator.send(`${message}`);
        console.error(message);
        this.terminal?.prompt();
    }

    private setupEvents(this: ClientInstance) {
        this.client.on('error', async (error: Error) => this.reportError(error, '`error` event'));
        this.client.on('guildMemberAdd', async (member: GuildMember) => this.onGuildMemberAdd(member));
        this.client.on('messageCreate', async (message: Message) => this.processMessage(message));
        this.client.on('messageReactionAdd', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => this.onReactionToggled(reaction, user, true));
        this.client.on('messageReactionRemove', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => this.onReactionToggled(reaction, user, false));
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
        this.client.on('interactionCreate', async (interaction) => this.handleInteraction(interaction));
        this.client.on('ready', async () => this.onReady());
    }

    private async allowInteraction(interaction: CommandInteraction, command: Command): Promise<boolean> {
        if (interaction.guild) {
            if (command.getPermissions) {
                const permissions: ApplicationCommandPermissionData[] = [];
                await command.getPermissions(interaction.guild, permissions);
                return permissions.some((perm) => {
                    switch (perm.type) {
                        case 'ROLE':
                            if (!(interaction.member instanceof GuildMember) || !interaction.guild) {
                                return false;
                            }
                            return interaction.member.roles.cache.has(perm.id);
                        case 'USER':
                            return interaction.user.id === perm.id;
                        default:
                            break;
                    }
                    return false;
                });
            }
        }
        return true;
    }

    private async handleInteraction(this: ClientInstance, interaction: Interaction) {
        switch (interaction.type) {
            case 'APPLICATION_COMMAND':
                await this.handleCommandInteraction(interaction as CommandInteraction);
                break;
            case 'APPLICATION_COMMAND_AUTOCOMPLETE':
                await this.handleAutocompleteInteraction(interaction as AutocompleteInteraction);
                break;
            default:
                break;
        }
    }

    private async handleCommandInteraction(this: ClientInstance, interaction: CommandInteraction) {
        try {
            const command = this.commands.get(interaction.commandName);
            if (command && !this.allowInteraction(interaction, command)) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }
            await command?.execute(interaction, this);
        }
        catch (e) {
            await this.reportError(e, 'handleCommandInteraction');
        }
    }

    private async handleAutocompleteInteraction(this: ClientInstance, interaction: AutocompleteInteraction) {
        try {
            const command = this.commands.get(interaction.commandName);
            if (command?.autocomplete) {
                await command.autocomplete(interaction, this);
            }
            else {
                await interaction.respond([]);
            }
        }
        catch (e) {
            await this.reportError(e, 'handleAutocompleteInteraction');
        }
    }

    private async onGuildMemberAdd(this: ClientInstance, member: GuildMember): Promise<void> {
        if (!this.shouldRespond) {
            return;
        }
        await welcome(member, async (msg) => this.reportError(msg, 'onGuildMemberAdd'));
    }

    private async onReactionToggled(this: ClientInstance, reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, added: boolean): Promise<void> {
        if (!this.shouldRespond) {
            return;
        }
        try {
            const fullReaction = await reaction.fetch();
            const {guild} = fullReaction.message;
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
        const serversWithGuilds = config.legacy.servers
            .map((server) => {
                const guild = this.client.guilds.cache.get(server.id);
                return { server, guild };
            });
        const pendingServers = serversWithGuilds
            .map(async ({ server, guild }) => {
                if (!guild) {
                    return;
                }
                await guild.channels.fetch();
                const messagesWithChannels = server.messagesToCache
                    .map((msg) => {
                        const channel = getCachedChannel(guild, msg.channelID) as TextChannel;
                        return { msg, channel };
                    });
                const pendingFetches = messagesWithChannels
                    .map(async ({ msg, channel }) => {
                        if (!channel || msg.messageID.length === 0) {
                            return;
                        }
                        try {
                            await channel.messages.fetch(msg.messageID);
                        }
                        catch (err) {
                            this.reportError(err, 'setupServers');
                        }
                    });
                await Promise.all(pendingFetches);
            });
        await Promise.all(pendingServers);
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
            if (ignoreMessage(this, message)) {
                return;
            }
            const server = findServer(message.guild);
            if (server && hasCommandPrefix(message, server)) {
                await this.processCommandMessage(message, server);
            }
            else {
                await handleNonCommand(message);
            }
        }
        catch (e) {
            this.reportError(e, 'processMessage');
        }
    }

    private async processCommandMessage(message: Message, server: { commands: CommandSettings[] }) {
        const messageCommandText = message.content.slice(1, message.content.indexOf(' '));
        const serverCommand = server.commands.find((c) => c.symbol === messageCommandText);
        if (serverCommand) {
            await handleCommand(serverCommand, message, (err) => this.reportError(err, 'handleCommand'));
        }
        else {
            await giveCaseWarning(message, messageCommandText, server);
        }
    }
}

async function giveCaseWarning(message: Message, messageCommandText: string, server: { commands: CommandSettings[] }): Promise<void> {
    const similar = server.commands.filter(c => c.symbol.toLowerCase() === messageCommandText.toLowerCase());
    if (similar.length > 0) {
        const msg = `did you mean ${similar.length > 1 ? `any of ${similar}` : `"${similar.at(0)}"`}? Commands are cASe-SeNsiTIvE.`;
        await message.reply(msg);
    }
}

function ignoreMessage(client: ClientInstance, message: Message) {
    if (!client.shouldRespond) {
        return true;
    }
    if (message.author.bot) {
        return true;
    }
    return false;
}

function hasCommandPrefix(message: Message, server: { commandPrefix: string; }) {
    if (!server) {
        return false;
    }
    return message.content.startsWith(server.commandPrefix);
}

