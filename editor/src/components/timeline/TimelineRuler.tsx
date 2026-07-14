import { useMemo } from "react";
import {
  buildTicks,
  formatTimeLabel,
  pickTickIntervals,
} from "../../lib/timeline-time";
import { LABEL_OFFSET, RULER_HEIGHT } from "./constants";

type Props = {
  duration: number;
  pxPerSec: number;
  trackWidth: number;
  onScrubStart: (clientX: number) => void;
};

const TICK_HEIGHT = {
  major: 10,
  medium: 7,
  minor: 4,
} as const;

export function TimelineRuler({
  duration,
  pxPerSec,
  trackWidth,
  onScrubStart,
}: Props) {
  const intervals = useMemo(() => pickTickIntervals(pxPerSec), [pxPerSec]);
  const ticks = useMemo(
    () => buildTicks(duration, intervals, pxPerSec),
    [duration, intervals, pxPerSec],
  );

  return (
    <div
      className="relative shrink-0 cursor-ew-resize border-b border-border/60 bg-panel select-none"
      style={{ height: RULER_HEIGHT, width: LABEL_OFFSET + trackWidth }}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        onScrubStart(e.clientX);
      }}
    >
      {ticks.map((tick) => {
        const left = LABEL_OFFSET + tick.sec * pxPerSec;
        const h = TICK_HEIGHT[tick.tier];
        return (
          <div
            key={tick.sec}
            className="pointer-events-none absolute bottom-0 flex flex-col items-center"
            style={{ left, transform: "translateX(-50%)" }}
          >
            {tick.tier === "major" ? (
              <span className="mb-0.5 text-[10px] leading-none text-muted">
                {formatTimeLabel(tick.sec)}
              </span>
            ) : (
              <span className="mb-0.5 h-[13px]" />
            )}
            <div
              className={
                tick.tier === "major"
                  ? "w-px bg-muted/80"
                  : tick.tier === "medium"
                    ? "w-px bg-muted/50"
                    : "w-px bg-muted/30"
              }
              style={{ height: h }}
            />
          </div>
        );
      })}
    </div>
  );
}
