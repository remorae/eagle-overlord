import {  NewsChannel, PartialDMChannel,  TextBasedChannels } from "discord.js";

export type NonVoiceChannel = Exclude<PartialNonVoiceChannel, PartialDMChannel>
export type PartialNonVoiceChannel = Exclude<TextBasedChannels, NewsChannel>