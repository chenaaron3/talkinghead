import { useMemo } from "react";
import type { FlatCaption } from "../../../lib/captions";
import { sampleWaveformGrid } from "@src/lib/audio/waveform";
import type { WaveformBar } from "@src/lib/audio/waveform";
import { useEditor } from "../../../store";

type Props = {
  start: number;
  end: number;
  captions: FlatCaption[];
};

const CENTER = 50;
const MAX_HALF = 46;
const MIN_HALF = 3;
const CENTER_GAP = 1.2;
/** One bar every BAR_PX pixels — density only changes with zoom. */
const BAR_PX = 2.2;

/** Fallback envelope from caption timing when audio peaks are not loaded yet. */
function buildCaptionEnvelopeGrid(
  start: number,
  end: number,
  captions: FlatCaption[],
  secondsPerBar: number,
): WaveformBar[] {
  const duration = end - start;
  if (duration <= 0 || secondsPerBar <= 0) return [];

  const words = captions.filter((c) => c.start < end && c.end > start);
  const out: WaveformBar[] = [];
  const first = Math.floor(start / secondsPerBar);
  const last = Math.ceil(end / secondsPerBar) - 1;

  for (let i = first; i <= last; i++) {
    const t0 = i * secondsPerBar;
    const tCenter = t0 + secondsPerBar / 2;
    if (tCenter < start || tCenter > end) continue;
    const active = words.some((w) => tCenter >= w.start && tCenter < w.end);
    out.push({
      x: (tCenter - start) / duration,
      amp: active ? 0.7 : 0.04,
    });
  }

  return out;
}

export function VoiceBand({ start, end, captions }: Props) {
  const waveform = useEditor((s) => s.waveform);
  const waveformMax = useEditor((s) => s.waveformMax);
  const pxPerSec = useEditor((s) => s.pxPerSec);

  const bars = useMemo(() => {
    if (pxPerSec <= 0 || end <= start) return [];
    const secondsPerBar = BAR_PX / pxPerSec;

    if (waveform && waveformMax > 0) {
      return sampleWaveformGrid(
        waveform,
        start,
        end,
        secondsPerBar,
        waveformMax,
      );
    }

    return buildCaptionEnvelopeGrid(start, end, captions, secondsPerBar);
  }, [start, end, captions, pxPerSec, waveform, waveformMax]);

  if (bars.length < 2) return null;

  const topEnd = CENTER - CENTER_GAP / 2;
  const bottomStart = CENTER + CENTER_GAP / 2;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {bars.map((bar, i) => {
        const x = bar.x * 100;
        const half =
          bar.amp > 0.02
            ? Math.max(MIN_HALF, bar.amp * MAX_HALF)
            : MIN_HALF;

        return (
          <g key={i} stroke="#1a1508" strokeLinecap="round">
            <line
              x1={x}
              y1={topEnd - half}
              x2={x}
              y2={topEnd}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={x}
              y1={bottomStart}
              x2={x}
              y2={bottomStart + half}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}
