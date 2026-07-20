import { resolveShakeIntensity } from "../../lib/vfx";
import { useEditor } from "../../store";
import type { SourceShakeVfx } from "@src/lib/types";

import { SliderField } from "./field";

export function ShakeVfxInspector({ clip }: { clip: SourceShakeVfx }) {
  const updateVfxIntensity = useEditor((s) => s.updateVfxIntensity);
  const intensity = resolveShakeIntensity(clip);

  return (
    <div className="flex flex-col gap-4">
      <SliderField
        label="Intensity"
        value={intensity}
        min={0.002}
        max={0.06}
        step={0.001}
        display={`${(intensity * 100).toFixed(1)}%`}
        onLiveChange={(value) => updateVfxIntensity(clip.id, value, true)}
        onCommit={(value) => updateVfxIntensity(clip.id, value, true)}
      />
    </div>
  );
}
