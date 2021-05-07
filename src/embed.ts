import { MessageEmbed, Message, ColorResolvable, TextChannel } from 'discord.js';
import { parseChannel } from './utils';
import { ErrorFunc } from './error';

export function createEmbed(title: string, color: ColorResolvable,
    description: string): MessageEmbed {
    return new MessageEmbed()
        .setTitle(title)
        .setColor(color)
        .setDescription(description);
}

export function handleEmbed(message: Message, args: string[],
    reportError: ErrorFunc): void {
    if (args.length < 4) {
        message.channel.send(`Missing message. See \`!help embed\` for more info.`)
        return;
    }
    const destChannel = parseChannel(message, args[0]) as TextChannel;
    if (!destChannel) {
        message.channel.send(`Invalid channel.`);
        return;
    }
    const title = args[1].replace(/(^\"|\"$)/g, ``);
    const colorStr = args[2];
    const descStr = args[3].replace(/(^\`\`\`|\`\`\`$)/g, ``);
    const toEdit = (args.length > 4) ? args[4] : null;

    const embed = createEmbed(title, parseInt(colorStr), descStr);

    if (toEdit) {
        destChannel.messages.fetch(toEdit)
            .then((msg: Message) => msg.edit(embed).catch(reportError))
            .catch(() => message.channel.send(`Invalid message to edit.`));
    } else {
        destChannel.send(embed);
    }
}