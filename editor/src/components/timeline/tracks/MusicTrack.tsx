import { useMemo } from "react";

import { mergeDuckRegionsSec } from "@src/lib/music-duck";

import { EMPTY_CAPTIONS, EMPTY_SFX } from "../../../lib/empty";
import { isSelected } from "../../../lib/selection";
import { useSelection } from "../../../selection-store";
import { useEditor } from "../../../store";
import { TrackLabel } from "../shared";

type Props = {
  width: number;
  sourceX: (sourceSec: number) => number;
};

export function MusicTrack({ width, sourceX }: Props) {
  const music = useEditor((s) => s.config?.music ?? null);
  const duration = useEditor((s) => s.transcript?.duration ?? 0);
  const captions = useEditor((s) => s.transcript?.captions ?? EMPTY_CAPTIONS);
  const sfx = useEditor((s) => s.config?.sfx ?? EMPTY_SFX);
  const selection = useSelection((s) => s.selection);
  const selectMusic = useSelection((s) => s.selectMusic);

  const duckRegions = useMemo(
    () =>
      mergeDuckRegionsSec([
        ...captions.map((c) => ({ start: c.start, end: c.end })),
        ...sfx.map((c) => ({ start: c.start, end: c.end })),
      ]),
    [captions, sfx],
  );

  if (!music || duration <= 0) return null;

  const left = sourceX(0);
  const right = sourceX(duration);
  const label = music.src.split("/").pop() ?? "Music";
  const selected = isSelected(selection, "music", music.id);

  return (
    <TrackLabel label="Music" width={width}>
      <div
        className={`absolute top-1 bottom-1 cursor-pointer overflow-hidden rounded select-none ${
          selected ? "z-[2] outline outline-2 outline-white" : ""
        }`}
        style={{ left, width: Math.max(8, right - left) }}
        onClick={(e) => {
          e.stopPropagation();
          selectMusic(music.id);
        }}
        title={`${label} — dimmed = ducked under captions/SFX`}
      >
        <div className="absolute inset-0 bg-music" />
        {duckRegions.map((region) => {
          const rLeft = sourceX(region.start) - left;
          const rRight = sourceX(region.end) - left;
          return (
            <div
              key={`${region.start}-${region.end}`}
              className="absolute top-0 bottom-0 bg-black/50"
              style={{
                left: Math.max(0, rLeft),
                width: Math.max(2, rRight - rLeft),
              }}
              title="Ducked"
            />
          );
        })}
        <span className="relative z-[1] flex h-full items-center px-1.5 text-[10px] text-[#1e1b4b]">
          {label}
        </span>
      </div>
    </TrackLabel>
  );
}
