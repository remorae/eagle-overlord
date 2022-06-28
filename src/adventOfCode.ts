import type { TextChannel, ThreadChannel } from 'discord.js';
import { createEmbed } from './embed.js';
import type { ErrorFunc } from './error.js';
import type { NonVoiceChannel } from './types.js';
import bent from 'bent';
import { findServer } from './settings.js';

const millisPerSecond = 1000;
const secondsPerMinute = 60;
const minutesPerHour = 60;
const hoursPerDay = 24;
const daysPerWeek = 7;
const secondsPerHour = secondsPerMinute * minutesPerHour;

function getEasternTime(): Date {
    const utc = new Date();
    const estOffset = -5;
    return new Date(utc.getTime() + (estOffset * secondsPerHour * millisPerSecond)); // -5 hours
}

const enum Months {
    november = 10,
    december
}
const christmasDayNum = 25;

export async function linkCurrentAdventOfCodePage(channel: NonVoiceChannel): Promise<void> {
    const eastern = getEasternTime();
    const day = eastern.getDate();
    if (eastern.getMonth() === Months.december && day <= christmasDayNum) { // December 1-25
        await channel.send(`https://adventofcode.com/${eastern.getFullYear()}/day/${day}`);
    }
}

function nextAdventOfCodeWithin24Hours(now: Date): boolean {
    const lastDayOfNovember = 30;
    return (now.getMonth() === Months.november && now.getDate() === lastDayOfNovember) // November 30
        || (now.getMonth() === Months.december && now.getDate() < christmasDayNum); // December 1-24
}

function extractRemainingTime(millis: number) {
    const seconds = millis / millisPerSecond;
    const minutes = seconds / secondsPerMinute;
    const hours = minutes / minutesPerHour;
    const days = hours / hoursPerDay;
    const weeks = days / daysPerWeek;
    return {
        weeks: Math.floor(weeks),
        days: Math.floor(days) % daysPerWeek,
        hours: Math.floor(hours) % hoursPerDay,
        minutes: Math.floor(minutes) % minutesPerHour,
        seconds: Math.floor(seconds) % secondsPerMinute
    };
}

export async function displayNextUnlock(channel: NonVoiceChannel): Promise<void> {
    const eastern = getEasternTime();
    const nextDay = new Date(Date.UTC(eastern.getUTCFullYear(), Months.december, ((eastern.getUTCMonth() < Months.december) ? 1 : eastern.getUTCDate() + 1), 0));
    const difference = nextDay.getTime() - eastern.getTime();
    const remaining = extractRemainingTime(difference);
    await channel.send(`Until next unlock: ${remaining.weeks}w ${remaining.days}d ${remaining.hours}h ${remaining.minutes}m ${remaining.seconds}s`);
    if (nextAdventOfCodeWithin24Hours(eastern) && remaining.hours === 0) {
        await channel.send(`Soon: https://adventofcode.com/${eastern.getFullYear()}/day/${eastern.getDate() + 1}`);
    }
}

export async function displayLeaderboard(channel: TextChannel | ThreadChannel, year: string,
    reportError: ErrorFunc): Promise<void> {
    const server = findServer(channel.guild);
    const aocYearInfo = server
        ? server.adventOfCode.find(info => info.year === year)
        : null;
    if (!aocYearInfo) {
        await channel.send('Invalid year.');
        return;
    }
    try {
        const response = await getAdventOfCodeResponse(aocYearInfo.url, aocYearInfo.session);
        const members = Object.values(response.members);
        await sendLeaderboardEmbed(members, year, channel);
    }
    catch (e) {
        await reportError(e);
    }
}

interface AOCMember {
    local_score: number;
    last_star_ts: number | string;
    name: string;
}

interface AOCResponse {
    members: { [key: string]: AOCMember; };
}

async function getAdventOfCodeResponse(url: string, session: string): Promise<AOCResponse> {
    const request = bent('GET', 'json', StatusCodes.ok);
    const body = await request(url, undefined, {
        'content-type': 'application/json',
        'cookie': `session=${session}`
    });
    return JSON.parse(body);
}

async function sendLeaderboardEmbed(members: AOCMember[], year: string, channel: TextChannel | ThreadChannel) {
    const msg = members
        .sort(sortBoardMembers)
        .map((member, i) => `${i}. ${member.name} ${member.local_score}`)
        .join('\n');
    const now = new Date().toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles'
    });
    const red = 0x990000;
    const embed = createEmbed(`${year} Leaderboard - ${now} UTC`, red, msg);
    await channel.send({ embeds: [embed] });
}

function sortBoardMembers(x: AOCMember, y: AOCMember): number {
    if (x !== y)
        return y.local_score - x.local_score; // Descending scores
    return new Date(x.last_star_ts).getTime() - new Date(y.last_star_ts).getTime(); // Ascending timestamps (chronological)
}