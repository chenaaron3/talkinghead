import {
  DEFAULT_KEN_BURNS,
  KEN_BURNS_MAX,
  KEN_BURNS_MIN,
  bRollSrcDurationSec,
  isVideoSrc,
  type Transform,
} from "../../lib/broll";
import { MIN_RANGE_SEC } from "../../lib/range";
import { useEditor } from "../../store";
import { VIDEO_BROLL_VOLUME_DEFAULT } from "@src/lib/episode/media";
import type { SourceBRoll } from "@src/lib/types";

import { EntranceSfxField } from "./EntranceSfxField";
import { SliderField, ToggleField, TransformFields } from "./field";

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
  const updateBRollKenBurns = useEditor((s) => s.updateBRollKenBurns);
  const updateBRollBehind = useEditor((s) => s.updateBRollBehind);
  const updateBRollSfx = useEditor((s) => s.updateBRollSfx);
  const updateBRollSfxVolume = useEditor((s) => s.updateBRollSfxVolume);
  const hasCutout = useEditor((s) => Boolean(s.config?.cutout));
  const isVideo = isVideoSrc(clip.src);

  const patch = (partial: Partial<Transform>, live: boolean) => {
    updateBRollTransform(clip.id, partial, live);
  };

  const mediaOffset = clip.mediaOffsetSec ?? 0;
  const volume = clip.volume ?? VIDEO_BROLL_VOLUME_DEFAULT;
  const srcDur = bRollSrcDurationSec(clip);
  const maxOffset =
    srcDur != null ? Math.max(0, srcDur - MIN_RANGE_SEC) : 0;
  const kenBurnsOn = clip.kenBurns != null;
  const kenBurns = clip.kenBurns ?? DEFAULT_KEN_BURNS;

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

      {hasCutout ? (
        <ToggleField
          label="Behind person"
          checked={Boolean(clip.behind)}
          onCheckedChange={(checked) =>
            updateBRollBehind(clip.id, checked, true)
          }
        />
      ) : null}

      <div className="flex flex-col gap-1.5">
        <ToggleField
          label="Ken Burns"
          checked={kenBurnsOn}
          onCheckedChange={(checked) =>
            updateBRollKenBurns(
              clip.id,
              checked ? DEFAULT_KEN_BURNS : null,
              true,
            )
          }
        />

        {kenBurnsOn ? (
          <SliderField
            label="End zoom"
            value={kenBurns}
            min={KEN_BURNS_MIN}
            max={KEN_BURNS_MAX}
            step={0.01}
            display={`${kenBurns.toFixed(2)}×`}
            onLiveChange={(v) => updateBRollKenBurns(clip.id, v, true)}
            onCommit={(v) => updateBRollKenBurns(clip.id, v, true)}
          />
        ) : null}
      </div>

      <EntranceSfxField
        value={clip.sfx}
        onChange={(sfx) => updateBRollSfx(clip.id, sfx, true)}
        onVolumeChange={(v) => updateBRollSfxVolume(clip.id, v, true)}
      />

      <TransformFields transform={transform} onPatch={patch} />
    </div>
  );
}
