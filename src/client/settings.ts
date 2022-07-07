import type { Guild } from 'discord.js';
import config from '../config.js';

export interface ServerSettings {
    name: string,
    id: string,
    channels: {
        name: string,
        id: string;
    }[];
    roles: {
        name: string,
        id: string,
        default: boolean
    }[];
}

export interface CommandSettings {
    name: string;
    symbol: string;
    usage: string;
    info: string;
    visible: boolean;
    permissions: string[];
}

export function findServer(guild: Guild | null) {
    if (!guild) {
        return null;
    }
    const found = config.servers.find((s) => s.id === guild.id);
    return found ?? null;
}

export async function findServerRole(guild: Guild, name: string) {
    const server = findServer(guild);
    const roleId = server?.roles.find((role) => role.name === name)?.id;
    if (roleId) {
        return guild.roles.fetch(roleId);
    }
    return null;
}

export async function findServerChannel(guild: Guild, name: string) {
    const server = findServer(guild);
    const channelId = server?.channels.find((channel) => channel.name === name)?.id;
    if (channelId) {
        return guild.channels.fetch(channelId);
    }
    return null;
}