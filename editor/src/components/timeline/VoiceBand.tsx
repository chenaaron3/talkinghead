import { useMemo } from "react";
import type { FlatCaption } from "../../lib/captions";
import { sampleWaveformRange } from "../../lib/waveform";
import { useEditor } from "../../store";

type Props = {
  start: number;
  end: number;
  captions: FlatCaption[];
  pixelWidth?: number;
};

const CENTER = 50;
const MAX_HALF = 46;
const MIN_HALF = 3;
const CENTER_GAP = 1.2;
const BAR_PX = 2.2;

function barCountForWidth(pixelWidth?: number): number {
  if (!pixelWidth) return 80;
  return Math.min(400, Math.max(40, Math.floor(pixelWidth / BAR_PX)));
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

export function VoiceBand({ start, end, captions, pixelWidth }: Props) {
  const waveform = useEditor((s) => s.waveform);
  const waveformMax = useEditor((s) => s.waveformMax);

  const { envelope, slot } = useMemo(() => {
    const samples = barCountForWidth(pixelWidth);

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
  }, [start, end, captions, pixelWidth, waveform, waveformMax]);

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
