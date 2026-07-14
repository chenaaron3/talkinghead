import type { SourcePunchIn } from "@src/lib/types";
import { MIN_RANGE_SEC } from "./range";

export const DEFAULT_PUNCH_IN_SCALE = 1.12;

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
