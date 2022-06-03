import { MessageEmbed, Message, ColorResolvable, TextChannel, HexColorString } from 'discord.js';
import { parseCachedChannel } from './utils';
import { ErrorFunc } from './error';

export function createEmbed(title: string, color: ColorResolvable,
    description: string): MessageEmbed {
    return new MessageEmbed()
        .setTitle(title)
        .setColor(color)
        .setDescription(description);
}

export async function handleEmbed(message: Message, args: string[],
    reportError: ErrorFunc): Promise<void> {
    if (args.length < 4) {
        await message.channel.send(`Missing message. See \`!help embed\` for more info.`)
        return;
    }
    const destChannel = parseCachedChannel(message, args[0]) as TextChannel;
    if (!destChannel) {
        await message.channel.send(`Invalid channel.`);
        return;
    }
    const title = args[1].replace(/(^"|"$)/g, ``);
    const colorStr = args[2];
    const color = colorStr.startsWith("0x") ? ("#" + colorStr.substr(2)) as HexColorString : parseInt(colorStr);
    const descStr = args[3].replace(/(^```|```$)/g, ``);
    const toEdit = (args.length > 4) ? args[4] : null;

    const embed = createEmbed(title, color, descStr);

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
            await message.channel.send(`Invalid message to edit.`);
        }
    } else {
        await destChannel.send({ embeds: [embed] });
    }
}