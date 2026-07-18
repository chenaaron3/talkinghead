import {
  BROLL_SCALE_MAX,
  BROLL_SCALE_MIN,
  TRANSFORM_DEFAULTS,
  bRollSrcDurationSec,
  isVideoSrc,
  type Transform,
} from "../../lib/broll";
import { MIN_RANGE_SEC } from "../../lib/range";
import { useEditor } from "../../store";
import { VIDEO_BROLL_VOLUME_DEFAULT } from "@src/lib/media";
import type { SourceBRoll } from "@src/lib/types";

import { Button } from "../ui/button";
import { NumberField, SliderField } from "./field";

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

      <SliderField
        label="Scale"
        value={transform.scale}
        min={BROLL_SCALE_MIN}
        max={BROLL_SCALE_MAX}
        step={0.01}
        display={`${transform.scale.toFixed(2)}×`}
        onLiveChange={(scale) => patch({ scale }, true)}
        onCommit={(scale) => patch({ scale }, true)}
      />

      <NumberField
        label="Offset X"
        value={transform.offsetX}
        step={0.01}
        onLiveChange={(offsetX) => patch({ offsetX }, true)}
      />

      <NumberField
        label="Offset Y"
        value={transform.offsetY}
        step={0.01}
        onLiveChange={(offsetY) => patch({ offsetY }, true)}
      />

      <SliderField
        label="Rotation"
        value={((transform.rotation % 360) + 360 + 180) % 360 - 180}
        min={-180}
        max={180}
        step={1}
        display={`${Math.round(transform.rotation)}°`}
        onLiveChange={(rotation) => patch({ rotation }, true)}
        onCommit={(rotation) => patch({ rotation }, true)}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1 w-full"
        onClick={() => {
          useEditor.getState().beginGesture();
          patch({ ...TRANSFORM_DEFAULTS }, false);
        }}
      >
        Reset transform
      </Button>
    </div>
  );
}
