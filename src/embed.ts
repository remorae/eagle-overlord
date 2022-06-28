import { MessageEmbed, Message, ColorResolvable, TextChannel, HexColorString } from 'discord.js';
import { parseCachedChannel } from './utils.js';
import type { ErrorFunc } from './error.js';

export function createEmbed(title: string, color: ColorResolvable,
    description: string): MessageEmbed {
    return new MessageEmbed()
        .setTitle(title)
        .setColor(color)
        .setDescription(description);
}

export async function handleEmbed(message: Message, args: string[], reportError: ErrorFunc): Promise<void> {
    const embedArgs = await parseEmbedArgs(args, message);
    if (embedArgs) {
        if (embedArgs.toEdit) {
            try {
                const msg = await embedArgs.channel.messages.fetch(embedArgs.toEdit);
                try {
                    await msg.edit({ embeds: [embedArgs.embed] });
                }
                catch (e) {
                    await reportError(e);
                }
            }
            catch (_) {
                await message.channel.send('Invalid message to edit.');
            }
        } else {
            await embedArgs.channel.send({ embeds: [embedArgs.embed] });
        }
    }
}

type EmbedArgs = {
    channel: TextChannel;
    embed: MessageEmbed;
    toEdit: string | undefined;
}

async function parseEmbedArgs(args: string[], message: Message): Promise<EmbedArgs | null> {
    const [channel, title, color, description, toEdit] = args;
    if (!channel || !title || !color || !description) {
        await message.channel.send('Missing argument. See `!help embed` for more info.');
        return null;
    }
    const textChannel = parseCachedChannel(message, channel) as TextChannel;
    if (!textChannel) {
        await message.channel.send('Invalid channel.');
        return null;
    }
    return {
        channel: textChannel,
        embed: createEmbed(
            title.replace(/(?:^"|"$)/g, ''),
            color.startsWith('0x') ? (`#${color.slice('0x'.length)}`) as HexColorString : parseInt(color, 10),
            description.replace(/(?:^```|```$)/g, '')),
        toEdit
    };
}