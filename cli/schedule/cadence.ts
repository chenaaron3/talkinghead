import { parseTimeOfDay } from "./config";

type ZoneParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getPartsInZone(date: Date, timeZone: string): ZoneParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Wall-clock date/time in `timeZone` → absolute UTC Date. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i++) {
    const parts = getPartsInZone(new Date(guess), timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const target = Date.UTC(year, month - 1, day, hour, minute, 0);
    guess += target - asUtc;
  }
  return new Date(guess);
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  days: number,
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

/**
 * Next daily slot at configured time in timezone.
 * - No prior schedules: today at slot if still ahead, else tomorrow.
 * - Else: day after the latest scheduledAt, at the configured time
 *   (bumped forward if that would be in the past).
 */
export function nextPublishAt(options: {
  scheduledAts: string[];
  time: string;
  timezone: string;
  now?: Date;
}): Date {
  const { hour, minute } = parseTimeOfDay(options.time);
  const now = options.now ?? new Date();
  const nowParts = getPartsInZone(now, options.timezone);

  const todaySlot = zonedTimeToUtc(
    nowParts.year,
    nowParts.month,
    nowParts.day,
    hour,
    minute,
    options.timezone,
  );

  if (options.scheduledAts.length === 0) {
    if (todaySlot > now) return todaySlot;
    const tomorrow = addCalendarDays(
      nowParts.year,
      nowParts.month,
      nowParts.day,
      1,
    );
    return zonedTimeToUtc(
      tomorrow.year,
      tomorrow.month,
      tomorrow.day,
      hour,
      minute,
      options.timezone,
    );
  }

  const latest = options.scheduledAts
    .map((s) => new Date(s))
    .reduce((a, b) => (a > b ? a : b));
  const latestParts = getPartsInZone(latest, options.timezone);
  const nextDay = addCalendarDays(
    latestParts.year,
    latestParts.month,
    latestParts.day,
    1,
  );
  let slot = zonedTimeToUtc(
    nextDay.year,
    nextDay.month,
    nextDay.day,
    hour,
    minute,
    options.timezone,
  );

  while (slot <= now) {
    const parts = getPartsInZone(slot, options.timezone);
    const bumped = addCalendarDays(parts.year, parts.month, parts.day, 1);
    slot = zonedTimeToUtc(
      bumped.year,
      bumped.month,
      bumped.day,
      hour,
      minute,
      options.timezone,
    );
  }

  return slot;
}

export function toRfc3339(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function formatLocalSlot(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
