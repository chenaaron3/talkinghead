import { VFX_META, VFX_PRESETS } from "../../lib/vfx";

import type { VfxPreset } from "../../lib/vfx";

export function VfxTab() {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex flex-col gap-1 p-2.5">
        {VFX_PRESETS.map((preset) => (
          <VfxPresetRow key={preset.type} preset={preset} />
        ))}
      </div>
    </div>
  );
}

function VfxPresetRow({ preset }: { preset: VfxPreset }) {
  const { Icon } = VFX_META[preset.type];
  return (
    <div
      className="flex cursor-grab items-center gap-2 rounded-lg border border-border bg-panel-2 px-2 py-1.5 select-none active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/x-vfx-preset",
          JSON.stringify(preset),
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={preset.label}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-vfx/25 text-vfx">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-[#e8eaef]">
        {preset.label}
      </span>
    </div>
  );
}
