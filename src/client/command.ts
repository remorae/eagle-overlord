import { SlashCommandBuilder } from "@discordjs/builders";
import { ApplicationCommandPermissionData, CommandInteraction, Guild, PermissionResolvable, Role } from "discord.js";

export interface Command {
    build(builder: SlashCommandBuilder): void,
    getPermissions(guild: Guild, permissions: ApplicationCommandPermissionData[]): Promise<void>,
    execute(interaction: CommandInteraction): Promise<void>
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
