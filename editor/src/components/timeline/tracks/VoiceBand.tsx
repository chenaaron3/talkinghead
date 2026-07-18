import { useMemo } from "react";
import type { FlatCaption } from "../../lib/captions";
import { sampleWaveformRange } from "@src/lib/waveform";
import { useEditor } from "../../store";

type Props = {
  start: number;
  end: number;
  captions: FlatCaption[];
};

const CENTER = 50;
const MAX_HALF = 46;
const MIN_HALF = 3;
const CENTER_GAP = 1.2;
const BAR_PX = 2.2;

/** One bar every BAR_PX pixels — density stays even across section cells. */
function barCountForDuration(
  durationSec: number,
  pxPerSec: number,
): number {
  if (durationSec <= 0 || pxPerSec <= 0) return 0;
  return Math.max(2, Math.ceil((durationSec * pxPerSec) / BAR_PX));
}

/** Fallback envelope from caption timing when audio peaks are not loaded yet. */
function buildCaptionEnvelope(
  start: number,
  end: number,
  captions: FlatCaption[],
  samples: number,
): number[] {
  const duration = end - start;
  if (duration <= 0) return [];

  const words = captions.filter((c) => c.start < end && c.end > start);
  return Array.from({ length: samples }, (_, i) => {
    const t = start + (i / Math.max(1, samples - 1)) * duration;
    const active = words.some((w) => t >= w.start && t < w.end);
    return active ? 0.7 : 0.04;
  });
}

export function VoiceBand({ start, end, captions }: Props) {
  const waveform = useEditor((s) => s.waveform);
  const waveformMax = useEditor((s) => s.waveformMax);
  const pxPerSec = useEditor((s) => s.pxPerSec);

  const { envelope, slot } = useMemo(() => {
    const samples = barCountForDuration(end - start, pxPerSec);

    const env =
      waveform && waveformMax > 0
        ? sampleWaveformRange(
            waveform,
            start,
            end,
            samples,
            waveformMax,
          )
        : buildCaptionEnvelope(start, end, captions, samples);

    return {
      envelope: env,
      slot: 100 / samples,
    };
  }, [start, end, captions, pxPerSec, waveform, waveformMax]);

  if (envelope.length < 2) return null;

  const topEnd = CENTER - CENTER_GAP / 2;
  const bottomStart = CENTER + CENTER_GAP / 2;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {envelope.map((amp, i) => {
        const x = (i + 0.5) * slot;
        const half =
          amp > 0.02
            ? Math.max(MIN_HALF, amp * MAX_HALF)
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
