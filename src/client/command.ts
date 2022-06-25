import { SlashCommandBuilder } from '@discordjs/builders';
import { ApplicationCommandPermissionData, CommandInteraction, Guild, PermissionResolvable, Role } from 'discord.js';
import * as path from 'path';
import * as fs from 'fs';
import { ClientInstance } from '../client';

export interface Command {
    build(builder: SlashCommandBuilder): Promise<void>,
    getPermissions(guild: Guild, permissions: ApplicationCommandPermissionData[]): Promise<void>,
    execute(interaction: CommandInteraction, client: ClientInstance): Promise<void>;
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const commandsDir = path.resolve(path.dirname(require.main!.filename), 'client', 'commands');
    const commandFiles = (await fs.promises.readdir(commandsDir)).filter(file => file.endsWith('.js'));
    return commandFiles.map(file => {
        const commandPath = path.resolve(commandsDir, file);
        if (reload) {
            // Update command in memory if the .js file has been modified (may need to hotfix things without restarting the bot)
            delete require.cache[commandPath];
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require(commandPath).command as Command;
    });
}
