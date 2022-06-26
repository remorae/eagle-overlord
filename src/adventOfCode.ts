import type { TextChannel, ThreadChannel } from 'discord.js';
import { createEmbed } from './embed.js';
import type { ErrorFunc } from './error.js';
import type { NonVoiceChannel } from './types.js';
import bent from 'bent';
import { findServer } from './settings.js';

function getEasternTime(): Date {
    const utc = new Date();
    return new Date(utc.getTime() - 5 * 3600 * 1000); // -5 hours
}

export async function linkCurrentAdventOfCodePage(channel: NonVoiceChannel): Promise<void> {
    const eastern = getEasternTime();
    const day = eastern.getDate();
    if (eastern.getMonth() === 11 && day <= 25) { // December 1-25
        await channel.send(`https://adventofcode.com/${eastern.getFullYear()}/day/${day}`);
    }
}

function nextAdventOfCodeWithin24Hours(now: Date): boolean {
    return (now.getMonth() === 10 && now.getDate() === 30) // November 30
        || (now.getMonth() === 11 && now.getDate() < 25); // December 1-24
}

function extractRemainingTime(millis: number) {
    let seconds = millis / 1000;
    let minutes = seconds / 60;
    let hours = minutes / 60;
    let days = hours / 24;
    let weeks = days / 7;
    weeks = Math.floor(weeks);
    days = Math.floor(days) % 7;
    hours = Math.floor(hours) % 24;
    minutes = Math.floor(minutes) % 60;
    seconds = Math.floor(seconds) % 60;
    return {
        'weeks': weeks,
        'days': days,
        'hours': hours,
        'minutes': minutes,
        'seconds': seconds
    };
}

export async function displayNextUnlock(channel: NonVoiceChannel): Promise<void> {
    const eastern = getEasternTime();
    const nextDay = new Date(Date.UTC(eastern.getUTCFullYear(), 11, ((eastern.getUTCMonth() < 11) ? 1 : eastern.getUTCDate() + 1), 0));
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
        const request = bent('GET', 'json', 200);
        const body = await request(aocYearInfo.url, undefined, {
            'content-type': 'application/json',
            'cookie': `session=${aocYearInfo.session}`
        });
        const result = JSON.parse(body);
        const members = Object.keys(result.members).map(k => result.members[k]); // Turn members into an array
        members.sort((x, y) => {
            if (x != y)
                return y.local_score - x.local_score; // Descending scores
            return new Date(x.last_star_ts).getTime() - new Date(y.last_star_ts).getTime(); // Ascending timestamps (chronological)
        });
        const board = members
            .map((member, i) => `${i}. ${member.name} ${member.local_score}`)
            .join('\n');
        const now = new Date().toLocaleString('en-US', {
            timeZone: 'America/Los_Angeles'
        });
        const embed = createEmbed(`${year} Leaderboard - ${now} UTC`, 0x990000, board);
        await channel.send({ embeds: [embed] });
    }
    catch (e) {
        await reportError(e);
    }
}