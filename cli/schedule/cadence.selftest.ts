/**
 * Quick sanity checks for nextPublishAt. Run: pnpm exec tsx cli/schedule/cadence.selftest.ts
 */
import { nextPublishAt } from "./cadence";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const tz = "America/New_York";
const time = "17:00";

// Empty queue, morning → today 17:00 ET
{
  const now = new Date("2026-07-10T15:00:00.000Z"); // 11:00 ET
  const slot = nextPublishAt({ scheduledAts: [], time, timezone: tz, now });
  assert(
    slot.toISOString() === "2026-07-10T21:00:00.000Z",
    `expected today 17:00 ET, got ${slot.toISOString()}`,
  );
}

// Empty queue, after 17:00 → tomorrow
{
  const now = new Date("2026-07-10T22:00:00.000Z"); // 18:00 ET
  const slot = nextPublishAt({ scheduledAts: [], time, timezone: tz, now });
  assert(
    slot.toISOString() === "2026-07-11T21:00:00.000Z",
    `expected tomorrow 17:00 ET, got ${slot.toISOString()}`,
  );
}

// Backlog → day after latest
{
  const now = new Date("2026-07-10T15:00:00.000Z");
  const slot = nextPublishAt({
    scheduledAts: ["2026-07-12T21:00:00.000Z"],
    time,
    timezone: tz,
    now,
  });
  assert(
    slot.toISOString() === "2026-07-13T21:00:00.000Z",
    `expected day after latest, got ${slot.toISOString()}`,
  );
}

console.log("cadence.selftest: ok");
