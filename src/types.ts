import { DMChannel, GroupDMChannel, TextChannel } from "discord.js";

export type NonVoiceChannel = TextChannel | DMChannel | GroupDMChannel;