import type { Guild } from 'discord.js';
import config from './config.js';

export interface CommandSettings {
  name: string;
  symbol: string;
  usage: string;
  info: string;
  visible: boolean;
  permissions: string[];
  requiresGuild: boolean;
}

export interface CompileLanguage {
  id: string;
  full: string;
  index: number;
}

export function findServer(guild: Guild | null) {
    if (!guild) {
        return null;
    }
    const found = config.legacy.servers.find((s) => s.id == guild.id);
    return found ?? null;
}