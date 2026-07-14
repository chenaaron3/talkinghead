const NICE_LABEL_SEC = [0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300] as const;

const TARGET_LABEL_PX = 96;
const MIN_MINOR_PX = 4;

export type TickIntervals = {
  labelSec: number;
  mediumSec: number;
  minorSec: number;
};

export function pickTickIntervals(pxPerSec: number): TickIntervals {
  const rawLabelSec = TARGET_LABEL_PX / pxPerSec;
  const labelSec =
    NICE_LABEL_SEC.find((n) => n >= rawLabelSec) ??
    NICE_LABEL_SEC[NICE_LABEL_SEC.length - 1]!;
  return {
    labelSec,
    mediumSec: labelSec / 2,
    minorSec: labelSec / 10,
  };
}

export function formatTimeLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatTimeHover(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type TimelineTick = {
  sec: number;
  tier: "major" | "medium" | "minor";
};

export function buildTicks(
  duration: number,
  intervals: TickIntervals,
  pxPerSec: number,
): TimelineTick[] {
  const { labelSec, mediumSec, minorSec } = intervals;
  const showMinor = minorSec * pxPerSec >= MIN_MINOR_PX;
  const step = showMinor ? minorSec : mediumSec;
  const ticks: TimelineTick[] = [];
  const count = Math.ceil(duration / step);

  for (let i = 0; i <= count; i++) {
    const sec = Math.round(i * step * 1000) / 1000;
    const isMajor =
      Math.abs(sec - Math.round(sec / labelSec) * labelSec) < step * 0.01;
    const isMedium =
      !isMajor &&
      Math.abs(sec - Math.round(sec / mediumSec) * mediumSec) < step * 0.01;

    let tier: TimelineTick["tier"] = "minor";
    if (isMajor) tier = "major";
    else if (isMedium) tier = "medium";
    else if (!showMinor) continue;

    ticks.push({ sec, tier });
  }

  return ticks;
}
