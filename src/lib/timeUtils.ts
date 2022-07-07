export const MILLIS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTE_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const DAYS_PER_WEEK = 7;
export const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTE_PER_HOUR;

export const enum Months {
    JANUARY = 0,
    FEBRUARY,
    MARCH,
    APRIL,
    MAY,
    JUNE,
    JULY,
    AUGUST,
    SEPTEMBER,
    OCTOBER,
    NOVEMBER,
    DECEMBER
}

export const CHRISTMAS_DAY_OF_MONTH = 25;

export interface RemainingTimeInYear {
    weeks: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

export function extractRemainingTime(millis: number): RemainingTimeInYear {
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

export function getEasternTime(): Date {
    const utc = new Date();
    const EST_OFFSET_FROM_UTC = -5;
    return new Date(utc.getTime() + (EST_OFFSET_FROM_UTC * SECONDS_PER_HOUR * MILLIS_PER_SECOND)); // -5 hours
}
