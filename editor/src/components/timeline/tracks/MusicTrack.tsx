import { useMemo } from "react";

import { duckAmountAtSec, mergeDuckRegionsSec } from "@src/lib/music-duck";
import {
  cutsToKeepRegions,
  intersectWithKeepRegions,
} from "@src/lib/source-timeline";

import { EMPTY_CAPTIONS, EMPTY_CUTS, EMPTY_SFX } from "../../../lib/empty";
import { isSelected } from "../../../lib/selection";
import { useSelection } from "../../../selection-store";
import { useEditor } from "../../../store";
import { TrackLabel } from "../shared";

type Props = {
  width: number;
  sourceX: (sourceSec: number) => number;
};

type SecRange = { start: number; end: number };

/** Map source time → output time by walking keep regions (null if cut). */
function toOutputSec(sourceSec: number, keeps: SecRange[]): number | null {
  let out = 0;
  for (const k of keeps) {
    if (sourceSec >= k.start && sourceSec <= k.end) {
      return out + (sourceSec - k.start);
    }
    out += k.end - k.start;
  }
  return null;
}

export function MusicTrack({ width, sourceX }: Props) {
  const music = useEditor((s) => s.config?.music ?? null);
  const duration = useEditor((s) => s.transcript?.duration ?? 0);
  const captions = useEditor((s) => s.transcript?.captions ?? EMPTY_CAPTIONS);
  const sfx = useEditor((s) => s.config?.sfx ?? EMPTY_SFX);
  const cuts = useEditor((s) => s.config?.cuts ?? EMPTY_CUTS);
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const selection = useSelection((s) => s.selection);
  const selectMusic = useSelection((s) => s.selectMusic);

  const keeps = useMemo(
    () => cutsToKeepRegions(cuts, duration),
    [cuts, duration],
  );

  const { fillPath, sampleCount } = useMemo(() => {
    const mapped: SecRange[] = [];
    for (const r of [...captions, ...sfx]) {
      for (const p of intersectWithKeepRegions(r.start, r.end, cuts, duration)) {
        const start = toOutputSec(p.start, keeps);
        const end = toOutputSec(p.end, keeps);
        if (start != null && end != null && end > start) {
          mapped.push({ start, end });
        }
      }
    }
    const regions = mergeDuckRegionsSec(mapped);
    const n = Math.max(2, Math.ceil((duration * pxPerSec) / 2));
    const tops = Array.from({ length: n }, (_, i) => {
      const sec = (i / (n - 1)) * duration;
      const out = toOutputSec(sec, keeps);
      // Cut → collapse fill (gray base shows through); else duck envelope
      const y = out == null ? 1 : duckAmountAtSec(out, regions);
      return `${i},${y}`;
    });
    return {
      sampleCount: n,
      fillPath: `M0,1 L${tops.join(" L")} L${n - 1},1 Z`,
    };
  }, [captions, sfx, cuts, duration, pxPerSec, keeps]);

  if (!music || duration <= 0) return null;

  const left = sourceX(0);
  const label = music.src.split("/").pop() ?? "Music";
  const selected = isSelected(selection, "music", music.id);

  return (
    <TrackLabel label="Music" width={width}>
      <div
        className={`absolute top-1 bottom-1 cursor-pointer overflow-hidden rounded bg-[#3a3f4d] select-none ${
          selected ? "z-[2] outline outline-2 outline-white" : ""
        }`}
        style={{ left, width: Math.max(8, sourceX(duration) - left) }}
        onClick={(e) => {
          e.stopPropagation();
          selectMusic(music.id);
        }}
        title={`${label} — height = unducked bed`}
      >
        {keeps.map((k) => (
          <div
            key={`${k.start}-${k.end}`}
            className="absolute inset-y-0 bg-music/25"
            style={{
              left: sourceX(k.start) - left,
              width: Math.max(1, sourceX(k.end) - sourceX(k.start)),
            }}
          />
        ))}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${sampleCount - 1} 1`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d={fillPath} className="fill-music" />
        </svg>
        <span className="relative z-[1] flex h-full items-center px-1.5 text-[10px] text-[#1e1b4b]">
          {label}
        </span>
      </div>
    </TrackLabel>
  );
}
