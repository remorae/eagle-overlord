import type { SlashCommandBuilder } from '@discordjs/builders';
import type { CommandInteraction } from 'discord.js';
import type { ClientInstance } from '../../client/client.js';
import { SECONDS_PER_HOUR, MILLIS_PER_SECOND, SECONDS_PER_MINUTE, MINUTE_PER_HOUR, HOURS_PER_DAY, DAYS_PER_WEEK } from '../timeConstants.js';
import type { Command } from '../command.js';

class AdventOfCodeCommand implements Command {
    async build(builder: SlashCommandBuilder): Promise<void> {
        builder
            .setName('aoc')
            .setDescription('Display information about Advent of Code.')
            .addSubcommand((cmd) =>
                cmd
                    .setName('info')
                    .setDescription("Link today's Advent of Code page and/or display a count down to the next day.")
            )
    }
    async execute(interaction: CommandInteraction, client: ClientInstance) {
        const cmd = interaction.options.getSubcommand(true);
        switch (cmd) {
            case 'info':
                await handleInfoCommand(interaction, client);
                break;
            default:
                await interaction.reply({ content: 'Invalid subcommand.' });
                break;
        }
    }
}

export const command: Command = new AdventOfCodeCommand();

async function handleInfoCommand(interaction: CommandInteraction, client: ClientInstance) {
    if (interaction.guild) {
        try {
            await linkCurrentAdventOfCodePage(interaction);
            await displayNextUnlock(interaction);
        }
        catch (e) {
            await client.reportError(e, 'handleInfoCommand');
            const msg = 'Something went wrong!';
            if (interaction.replied) {
                await interaction.followUp({ content: msg });
            }
            else {
                await interaction.reply({ content: msg });
            }
        }
    }
    else {
        await interaction.reply("the given command requires a guild. Please make sure you aren't using this command in a private message.");
    }
}

const enum Months {
    NOVEMBER = 10,
    DECEMBER
}
const CHRISTMAS_DAY_OF_MONTH = 25;

async function linkCurrentAdventOfCodePage(interaction: CommandInteraction): Promise<void> {
    const eastern = getEasternTime();
    const day = eastern.getDate();
    if (eastern.getMonth() === Months.DECEMBER && day <= CHRISTMAS_DAY_OF_MONTH) { // December 1-25
        const msg = `https://adventofcode.com/${eastern.getFullYear()}/day/${day}`;
        await interaction.reply({ content: msg });
    }
}

function getEasternTime(): Date {
    const utc = new Date();
    const EST_OFFSET_FROM_UTC = -5;
    return new Date(utc.getTime() + (EST_OFFSET_FROM_UTC * SECONDS_PER_HOUR * MILLIS_PER_SECOND)); // -5 hours
}

interface RemainingTimeInYear {
    weeks: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

async function displayNextUnlock(interaction: CommandInteraction): Promise<void> {
    const eastern = getEasternTime();
    const nextDay = new Date(Date.UTC(eastern.getUTCFullYear(), Months.DECEMBER, ((eastern.getUTCMonth() < Months.DECEMBER) ? 1 : eastern.getUTCDate() + 1), 0));
    const difference = nextDay.getTime() - eastern.getTime();
    const remaining = extractRemainingTime(difference);
    const nextUnlockMsg = `Until next unlock: ${remaining.weeks}w ${remaining.days}d ${remaining.hours}h ${remaining.minutes}m ${remaining.seconds}s`;
    if (interaction.replied) {
        await interaction.followUp({ content: nextUnlockMsg });
    }
    else {
        await interaction.reply({ content: nextUnlockMsg });
    }
    await displaySoonLink(interaction, eastern, remaining);
}

async function displaySoonLink(interaction: CommandInteraction, eastern: Date, remaining: RemainingTimeInYear) {
    if (nextAdventOfCodeWithin24Hours(eastern) && remaining.hours === 0) {
        const soonLinkmsg = `Soon: https://adventofcode.com/${eastern.getFullYear()}/day/${eastern.getDate() + 1}`;
        await interaction.followUp({ content: soonLinkmsg });
    }
}

function extractRemainingTime(millis: number) {
    const seconds = millis / MILLIS_PER_SECOND;
    const minutes = seconds / SECONDS_PER_MINUTE;
    const hours = minutes / MINUTE_PER_HOUR;
    const days = hours / HOURS_PER_DAY;
    const weeks = days / DAYS_PER_WEEK;
    return {
        weeks: Math.floor(weeks),
        days: Math.floor(days) % DAYS_PER_WEEK,
        hours: Math.floor(hours) % HOURS_PER_DAY,
        minutes: Math.floor(minutes) % MINUTE_PER_HOUR,
        seconds: Math.floor(seconds) % SECONDS_PER_MINUTE
    };
}

function nextAdventOfCodeWithin24Hours(now: Date): boolean {
    const LAST_DAY_OF_NOVEMBER = 30;
    return (now.getMonth() === Months.NOVEMBER && now.getDate() === LAST_DAY_OF_NOVEMBER) // November 30
        || (now.getMonth() === Months.DECEMBER && now.getDate() < CHRISTMAS_DAY_OF_MONTH); // December 1-24
}