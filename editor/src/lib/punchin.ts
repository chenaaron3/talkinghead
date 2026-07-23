import type { SourcePunchIn } from "@src/lib/types";
import {
  DEFAULT_PUNCH_IN_ORIGIN_X,
  DEFAULT_PUNCH_IN_ORIGIN_Y,
  DEFAULT_PUNCH_IN_SCALE,
  clampPunchInOrigin,
} from "@src/lib/visual/punchin";
import { MIN_RANGE_SEC } from "./range";

export {
  DEFAULT_PUNCH_IN_ANIMATE,
  DEFAULT_PUNCH_IN_ORIGIN_X,
  DEFAULT_PUNCH_IN_ORIGIN_Y,
  DEFAULT_PUNCH_IN_SCALE,
  DEFAULT_PUNCH_IN_WORD_BY_WORD,
  PUNCH_IN_STRENGTH,
  clampPunchInOrigin,
  punchInStrengthFromScale,
  resolvePunchInOrigin,
  type PunchInStrength,
} from "@src/lib/visual/punchin";

export function punchInForCaption(caption: {
  start: number;
  end: number;
}): SourcePunchIn {
  return {
    start: caption.start,
    end: Math.max(caption.start + MIN_RANGE_SEC, caption.end),
    scale: DEFAULT_PUNCH_IN_SCALE,
  };
}

/** True when playhead is inside the punch-in's source range. */
export function isPunchInActiveAt(
  punchIn: Pick<SourcePunchIn, "start" | "end">,
  sourceSec: number,
): boolean {
  return sourceSec >= punchIn.start && sourceSec < punchIn.end;
}

/** Apply origin; omit fields when they match defaults. */
export function withPunchInOrigin(
  punchIn: SourcePunchIn,
  originX: number,
  originY: number,
): SourcePunchIn {
  const x = clampPunchInOrigin(originX);
  const y = clampPunchInOrigin(originY);
  const { originX: _ox, originY: _oy, ...rest } = punchIn;
  const next: SourcePunchIn = { ...rest };
  if (x !== DEFAULT_PUNCH_IN_ORIGIN_X) next.originX = x;
  if (y !== DEFAULT_PUNCH_IN_ORIGIN_Y) next.originY = y;
  return next;
}
