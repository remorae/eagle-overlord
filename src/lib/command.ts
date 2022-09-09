import type { SlashCommandBuilder } from 'discord.js';
import { ApplicationCommandPermissions, ApplicationCommandPermissionType, AutocompleteInteraction, ChatInputCommandInteraction, Guild, ModalSubmitInteraction, PermissionResolvable, Role } from 'discord.js';
import path from 'path';
import { readdir } from 'fs/promises';
import type { ClientInstance } from '../client/client.js';
import { loadAtRuntime, resolveRelativeToMain } from '../lib/utils.js';

export interface Command {
    build(builder: SlashCommandBuilder): Promise<void>,
    getPermissions?(guild: Guild, permissions: ApplicationCommandPermissions[]): Promise<void>,
    execute(interaction: ChatInputCommandInteraction, client: ClientInstance): Promise<void>;
    autocomplete?(interaction: AutocompleteInteraction, client: ClientInstance): Promise<void>;
    receiveModal?(interaction: ModalSubmitInteraction, client: ClientInstance): Promise<void>;
}

export function commandRolePermission(role: string, allow: boolean): ApplicationCommandPermissions {
    return {
        id: role,
        type: ApplicationCommandPermissionType.Role,
        permission: allow,
    };
}

export function commandUserPermission(user: string, allow: boolean): ApplicationCommandPermissions {
    return {
        id: user,
        type: ApplicationCommandPermissionType.User,
        permission: allow,
    };
}

export function rolesWithPermissions(guild: Guild, permissions: PermissionResolvable): IterableIterator<Role> {
    return guild.roles.cache.filter(r => r.permissions.has(permissions)).values();
}

export async function getCommandsOnDisk(reload = true): Promise<Command[]> {
    const commandsDir = resolveRelativeToMain('lib/commands');
    if (!commandsDir) {
        return Promise.reject(new Error('Could not find commands directory.'));
    }
    const commandFiles = (await readdir(commandsDir)).filter(file => file.endsWith('.js'));
    return commandFiles.map(file => {
        const commandPath = path.resolve(commandsDir, file);
        return loadAtRuntime(commandPath, reload).command as Command;
    });
}

export const MAX_CHOICES = 25;
