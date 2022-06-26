import type { NewsChannel, PartialDMChannel, TextBasedChannel } from 'discord.js';

export type NonVoiceChannel = Exclude<PartialNonVoiceChannel, PartialDMChannel>;
export type PartialNonVoiceChannel = Exclude<TextBasedChannel, NewsChannel>;
export type UnionProperties<Union extends string> = { [key in Union]: undefined };