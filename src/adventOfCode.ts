import type { TextChannel, ThreadChannel } from 'discord.js';
import { createEmbed } from './embed.js';
import type { ErrorFunc } from './error.js';
import type { NonVoiceChannel } from './types.js';
import bent from 'bent';
import { findServer } from './settings.js';
import { DAYS_PER_WEEK, HOURS_PER_DAY, MILLIS_PER_SECOND, MINUTE_PER_HOUR, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from './constants.js';

function getEasternTime(): Date {
    const utc = new Date();
    const EST_OFFSET_FROM_UTC = -5;
    return new Date(utc.getTime() + (EST_OFFSET_FROM_UTC * SECONDS_PER_HOUR * MILLIS_PER_SECOND)); // -5 hours
}

const enum Months {
    NOVEMBER = 10,
    DECEMBER
}
const CHRISTMAS_DAY_OF_MONTH = 25;

export async function linkCurrentAdventOfCodePage(channel: NonVoiceChannel): Promise<void> {
    const eastern = getEasternTime();
    const day = eastern.getDate();
    if (eastern.getMonth() === Months.DECEMBER && day <= CHRISTMAS_DAY_OF_MONTH) { // December 1-25
        await channel.send(`https://adventofcode.com/${eastern.getFullYear()}/day/${day}`);
    }
}

function nextAdventOfCodeWithin24Hours(now: Date): boolean {
    const LAST_DAY_OF_NOVEMBER = 30;
    return (now.getMonth() === Months.NOVEMBER && now.getDate() === LAST_DAY_OF_NOVEMBER) // November 30
        || (now.getMonth() === Months.DECEMBER && now.getDate() < CHRISTMAS_DAY_OF_MONTH); // December 1-24
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

export async function displayNextUnlock(channel: NonVoiceChannel): Promise<void> {
    const eastern = getEasternTime();
    const nextDay = new Date(Date.UTC(eastern.getUTCFullYear(), Months.DECEMBER, ((eastern.getUTCMonth() < Months.DECEMBER) ? 1 : eastern.getUTCDate() + 1), 0));
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
    const request = bent('GET', 'json', StatusCodes.OK);
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
    const color = 0x990000;
    const embed = createEmbed(`${year} Leaderboard - ${now} UTC`, color, msg);
    await channel.send({ embeds: [embed] });
}

function sortBoardMembers(x: AOCMember, y: AOCMember): number {
    if (x !== y)
        return y.local_score - x.local_score; // Descending scores
    return new Date(x.last_star_ts).getTime() - new Date(y.last_star_ts).getTime(); // Ascending timestamps (chronological)
}