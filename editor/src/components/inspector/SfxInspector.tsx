import { SFX_VOLUME_DEFAULT } from "@src/lib/media";
import type { SourceSfx } from "@src/lib/types";

import { useEditor } from "../../store";
import { SliderField } from "./field";

export function SfxInspector({ clip }: { clip: SourceSfx }) {
  const updateSfxVolume = useEditor((s) => s.updateSfxVolume);
  const volume = clip.volume ?? SFX_VOLUME_DEFAULT;

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
        onLiveChange={(v) => updateSfxVolume(clip.id, v, true)}
        onCommit={(v) => updateSfxVolume(clip.id, v, true)}
      />
    </div>
  );
}
