import type { ImageAsset } from "@src/lib/types";

import { useSelection } from "../selection-store";
import { useEditor } from "../store";
import {
  isVfxActiveAt,
  resolveTransform,
  vfxHasMedia,
  vfxSupportsTransform,
  type SourceVfxWithTransform,
  type Transform,
} from "../lib/vfx";

export type EditableVfx = {
  clip: SourceVfxWithTransform & ImageAsset;
  transform: Transform;
};

/** Selected transformable VFX with baked media, visible under the playhead. */
export function useEditableVfx(): EditableVfx | null {
  const selection = useSelection((s) => s.selection);
  const sourceSec = useEditor((s) => s.sourceSec);
  const vfx = useEditor((s) => s.config?.vfx);

  if (selection?.kind !== "vfx") return null;
  const id = selection.ids[0];
  if (typeof id !== "string") return null;
  const clip = vfx?.find((c) => c.id === id);
  if (
    !clip ||
    !vfxHasMedia(clip) ||
    !vfxSupportsTransform(clip) ||
    !isVfxActiveAt(clip, sourceSec)
  ) {
    return null;
  }
  return {
    clip,
    transform: resolveTransform(clip),
  };
}
