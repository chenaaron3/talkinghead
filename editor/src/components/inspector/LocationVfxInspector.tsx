import {
  resolveTransform,
  vfxHasMedia,
  type Transform,
} from "../../lib/vfx";
import { useEditor } from "../../store";
import type { SourceLocationVfx } from "@src/lib/types";

import { AddressField, TransformFields } from "./field";

export function LocationVfxInspector({ clip }: { clip: SourceLocationVfx }) {
  const updateVfxTransform = useEditor((s) => s.updateVfxTransform);
  const setVfxLocation = useEditor((s) => s.setVfxLocation);
  const episodeId = useEditor((s) => s.episodeId);
  const transform = resolveTransform(clip);
  const hasMedia = vfxHasMedia(clip);

  const patch = (partial: Partial<Transform>, live: boolean) => {
    updateVfxTransform(clip.id, partial, live);
  };

  return (
    <div className="flex flex-col gap-4">
      <AddressField
        value={clip.label}
        resolvedLabel={hasMedia ? clip.label : null}
        episodeId={episodeId}
        onSelect={async (place) => {
          await setVfxLocation(clip.id, place);
        }}
      />

      {hasMedia ? <TransformFields transform={transform} onPatch={patch} /> : null}
    </div>
  );
}
