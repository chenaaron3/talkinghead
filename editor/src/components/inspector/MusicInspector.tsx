import { MUSIC_VOLUME_DEFAULT } from "@src/lib/media";
import type { SourceMusic } from "@src/lib/types";

import { useEditor } from "../../store";
import { SliderField } from "./field";

export function MusicInspector({ clip }: { clip: SourceMusic }) {
  const updateMusicVolume = useEditor((s) => s.updateMusicVolume);
  const updateMusicOffset = useEditor((s) => s.updateMusicOffset);
  const clearMusic = useEditor((s) => s.clearMusic);
  const volume = clip.volume ?? MUSIC_VOLUME_DEFAULT;
  const offset = clip.mediaOffsetSec ?? 0;
  const maxOffset = Math.max(0, clip.srcDurationSec - 0.04);

  return (
    <div className="flex flex-col gap-4">
      <p className="truncate text-[11px] text-muted" title={clip.src}>
        {clip.src.split("/").pop()}
      </p>
      <SliderField
        label="Volume"
        value={volume}
        min={0}
        max={1}
        step={0.01}
        display={`${Math.round(volume * 100)}%`}
        onLiveChange={(v) => updateMusicVolume(v, true)}
        onCommit={(v) => updateMusicVolume(v, true)}
      />
      {maxOffset > 0 ? (
        <SliderField
          label="Start offset"
          value={offset}
          min={0}
          max={maxOffset}
          step={0.1}
          display={`${offset.toFixed(1)}s`}
          onLiveChange={(v) => updateMusicOffset(v, true)}
          onCommit={(v) => updateMusicOffset(v, true)}
        />
      ) : null}
      <p className="text-[10px] leading-snug text-muted">
        Bed sits low under dialogue. Music ducks automatically under captions
        and SFX.
      </p>
      <button
        type="button"
        className="rounded border border-border bg-panel-2 px-2 py-1.5 text-[11px] text-[#e8eaef] hover:border-accent"
        onClick={() => clearMusic()}
      >
        Remove music
      </button>
    </div>
  );
}
