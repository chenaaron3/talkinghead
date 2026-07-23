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
  // Derived selectors keep this from re-rendering on every playback frame:
  // `sourceSec` changes per frame, but the boolean it feeds rarely does.
  const id = useSelection((s) =>
    s.selection?.kind === "vfx" && typeof s.selection.ids[0] === "string"
      ? s.selection.ids[0]
      : null,
  );
  const clip = useEditor((s) =>
    id != null ? (s.config?.vfx?.find((c) => c.id === id) ?? null) : null,
  );
  const active = useEditor(
    (s) => clip != null && isVfxActiveAt(clip, s.sourceSec),
  );

  if (!clip || !active || !vfxHasMedia(clip) || !vfxSupportsTransform(clip)) {
    return null;
  }
  return {
    clip,
    transform: resolveTransform(clip),
  };
}
