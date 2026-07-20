import {
  bRollSrcDurationSec,
  isVideoSrc,
  type Transform,
} from "../../lib/broll";
import { MIN_RANGE_SEC } from "../../lib/range";
import { useEditor } from "../../store";
import { VIDEO_BROLL_VOLUME_DEFAULT } from "@src/lib/media";
import type { SourceBRoll } from "@src/lib/types";

import { SliderField, TransformFields } from "./field";

export function BRollInspector({
  clip,
  transform,
}: {
  clip: SourceBRoll;
  transform: Transform;
}) {
  const updateBRollTransform = useEditor((s) => s.updateBRollTransform);
  const updateBRollMediaOffset = useEditor((s) => s.updateBRollMediaOffset);
  const updateBRollVolume = useEditor((s) => s.updateBRollVolume);
  const isVideo = isVideoSrc(clip.src);

  const patch = (partial: Partial<Transform>, live: boolean) => {
    updateBRollTransform(clip.id, partial, live);
  };

  const mediaOffset = clip.mediaOffsetSec ?? 0;
  const volume = clip.volume ?? VIDEO_BROLL_VOLUME_DEFAULT;
  const srcDur = bRollSrcDurationSec(clip);
  const maxOffset =
    srcDur != null ? Math.max(0, srcDur - MIN_RANGE_SEC) : 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="truncate text-[11px] text-muted" title={clip.src}>
        {clip.src.split("/").pop()}
      </p>

      {isVideo ? (
        <>
          <SliderField
            label="Media offset"
            value={mediaOffset}
            min={0}
            max={maxOffset || 0.001}
            step={0.01}
            display={`${mediaOffset.toFixed(2)}s`}
            onLiveChange={(v) => updateBRollMediaOffset(clip.id, v, true)}
            onCommit={(v) => updateBRollMediaOffset(clip.id, v, true)}
          />
          <SliderField
            label="Volume"
            value={volume}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round(volume * 100)}%`}
            onLiveChange={(v) => updateBRollVolume(clip.id, v, true)}
            onCommit={(v) => updateBRollVolume(clip.id, v, true)}
          />
        </>
      ) : null}

      <TransformFields transform={transform} onPatch={patch} />
    </div>
  );
}
