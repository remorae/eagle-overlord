import type { SlashCommandBuilder } from '@discordjs/builders';
import type { ApplicationCommandPermissionData, AutocompleteInteraction, CommandInteraction, Guild, ModalSubmitInteraction, PermissionResolvable, Role } from 'discord.js';
import path from 'path';
import { readdir } from 'fs/promises';
import type { ClientInstance } from '../client.js';
import { loadAtRuntime, resolveRelativeToMain } from '../utils.js';

export interface Command {
    build(builder: SlashCommandBuilder): Promise<void>,
    getPermissions?(guild: Guild, permissions: ApplicationCommandPermissionData[]): Promise<void>,
    execute(interaction: CommandInteraction, client: ClientInstance): Promise<void>;
    autocomplete?(interaction: AutocompleteInteraction, client: ClientInstance): Promise<void>;
    receiveModal?(interaction: ModalSubmitInteraction, client: ClientInstance): Promise<void>;
}

export function commandRolePermission(role: string, allow: boolean): ApplicationCommandPermissionData {
    return {
        id: role,
        type: 'ROLE',
        permission: allow,
    };
}

export function commandUserPermission(user: string, allow: boolean): ApplicationCommandPermissionData {
    return {
        id: user,
        type: 'USER',
        permission: allow,
    };
}

export function rolesWithPermissions(guild: Guild, permissions: PermissionResolvable): IterableIterator<Role> {
    return guild.roles.cache.filter(r => r.permissions.has(permissions)).values();
}

export async function getCommandsOnDisk(reload = true): Promise<Command[]> {
    const commandsDir = resolveRelativeToMain('client/commands');
    if (!commandsDir) {
        return Promise.reject(new Error('Could not find commands directory.'));
    }
    const commandFiles = (await readdir(commandsDir)).filter(file => file.endsWith('.js'));
    return commandFiles.map(file => {
        const commandPath = path.resolve(commandsDir, file);
        return loadAtRuntime(commandPath, reload).command as Command;
    });
}
