import type { SourcePunchIn } from "@src/lib/types";
import { DEFAULT_PUNCH_IN_SCALE } from "@src/lib/punchin";
import { MIN_RANGE_SEC } from "./range";

export {
  DEFAULT_PUNCH_IN_ANIMATE,
  DEFAULT_PUNCH_IN_SCALE,
  DEFAULT_PUNCH_IN_WORD_BY_WORD,
  PUNCH_IN_STRENGTH,
  punchInStrengthFromScale,
  type PunchInStrength,
} from "@src/lib/punchin";

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
