import { Command, getCommandsOnDisk } from '../lib/command.js';
import config from '../config.js';
import type { Terminal } from './terminal.js';
import { welcome } from '../lib/commands/welcome.js';

import { Client, Message, PartialMessage, GuildMember, Interaction, Collection, ApplicationCommandPermissionData, CommandInteraction, AutocompleteInteraction } from 'discord.js';
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
                .map(async (command: Command) => {
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
                            if (!interaction.inCachedGuild()) {
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
            console.log(`Received command: ${interaction.commandName}`)
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
        await welcome(member, this);
    }

    private async onReady(this: ClientInstance) {
        console.log('Pushing commands to Discord (dev guild)...');
        await this.deployCommands();
        console.log('Ready!');
        this.terminal?.prompt();
    }

    private async processMessage(this: ClientInstance, message: Message): Promise<void> {
        try {
            if (ignoreMessage(this, message)) {
                return;
            }
            await lookForSubreddits(message);
        }
        catch (e) {
            this.reportError(e, 'processMessage');
        }
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

async function lookForSubreddits(message: Message): Promise<void> {
    const matches = message.content.match(/(?:^|[^\w]+)\/r\/\w+/i);
    if (matches) {
        const url = matches[0]?.trim().toLowerCase();
        await message.channel.send(`<http://www.reddit.com${url}>`);
    }
}

