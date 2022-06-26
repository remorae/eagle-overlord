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

export async function handleEmbed(message: Message, args: string[],
    reportError: ErrorFunc): Promise<void> {
    const [channel, titleStr, colorStr, descStr, toEdit] = args.slice(0, 5);
    if (!channel || !titleStr || !colorStr || !descStr) {
        await message.channel.send('Missing argument. See `!help embed` for more info.');
        return;
    }
    const destChannel = parseCachedChannel(message, channel) as TextChannel;
    if (!destChannel) {
        await message.channel.send('Invalid channel.');
        return;
    }
    const title = titleStr.replace(/(^"|"$)/g, '');
    const color = colorStr.startsWith('0x') ? (`#${colorStr.slice(2)}`) as HexColorString : parseInt(colorStr);
    const desc = descStr.replace(/(^```|```$)/g, '');

    const embed = createEmbed(title, color, desc);

    if (toEdit) {
        try {
            const msg = await destChannel.messages.fetch(toEdit);
            try {
                await msg.edit({ embeds: [embed] });
            }
            catch (e) {
                await reportError(e);
            }
        }
        catch (_) {
            await message.channel.send('Invalid message to edit.');
        }
    } else {
        await destChannel.send({ embeds: [embed] });
    }
}