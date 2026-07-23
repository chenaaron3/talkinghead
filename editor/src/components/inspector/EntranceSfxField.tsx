import { useMemo } from "react";

import type { AudioAsset } from "@src/lib/types";
import { SFX_VOLUME_DEFAULT } from "@src/lib/episode/media";
import { useEditor, type SfxAsset } from "../../store";
import { InspectorCollapsible, SliderField } from "./field";

function sfxOptionLabel(asset: SfxAsset): string {
  const folder = asset.folder ? `${asset.folder}/` : "";
  return `${folder}${asset.label}`;
}

function audioFromAsset(
  asset: SfxAsset,
  volume?: number,
): AudioAsset {
  const out: AudioAsset = {
    src: asset.src,
    srcDurationSec: Math.max(0.05, asset.durationSec),
  };
  if (volume != null && volume !== SFX_VOLUME_DEFAULT) {
    out.volume = volume;
  }
  return out;
}

export function EntranceSfxField({
  value,
  onChange,
  onVolumeChange,
  title = "SFX played at the start of this clip",
  defaultOpen = false,
}: {
  /** Current entrance SFX, or null/undefined for None / unset. */
  value: AudioAsset | null | undefined;
  onChange: (sfx: AudioAsset | null) => void;
  onVolumeChange: (volume: number) => void;
  title?: string;
  defaultOpen?: boolean;
}) {
  const sfxAssets = useEditor((s) => s.sfxAssets);
  const sortedSfx = useMemo(
    () =>
      [...sfxAssets].sort((a, b) =>
        sfxOptionLabel(a).localeCompare(sfxOptionLabel(b)),
      ),
    [sfxAssets],
  );
  const src = value?.src ?? "";
  const stillListed =
    src.length === 0 || sortedSfx.some((a) => a.src === src);
  const volume = value?.volume ?? SFX_VOLUME_DEFAULT;

  return (
    <InspectorCollapsible title="Entrance SFX" defaultOpen={defaultOpen}>
      <select
        className="w-full rounded-md border border-border bg-panel-2 px-1.5 py-1 text-[11px] text-[#e8eaef] outline-none focus:border-accent"
        value={src}
        onChange={(e) => {
          const next = e.target.value;
          if (!next) {
            onChange(null);
            return;
          }
          const asset = sfxAssets.find((a) => a.src === next);
          if (asset) {
            onChange(audioFromAsset(asset, value?.volume));
          } else {
            onChange({
              src: next,
              srcDurationSec: value?.srcDurationSec ?? 1,
              ...(value?.volume != null ? { volume: value.volume } : {}),
            });
          }
        }}
        title={title}
      >
        <option value="">None</option>
        {!stillListed && src ? <option value={src}>{src}</option> : null}
        {sortedSfx.map((asset) => (
          <option key={asset.key} value={asset.src}>
            {sfxOptionLabel(asset)}
          </option>
        ))}
      </select>
      {value ? (
        <SliderField
          label="SFX volume"
          value={volume}
          min={0}
          max={1}
          step={0.01}
          display={`${Math.round(volume * 100)}%`}
          onLiveChange={onVolumeChange}
          onCommit={onVolumeChange}
        />
      ) : null}
    </InspectorCollapsible>
  );
}
