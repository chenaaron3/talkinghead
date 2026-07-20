import type { Transform } from "@src/lib/types";

import { useEditableBRoll } from "./use-editable-broll";
import { useEditableVfx } from "./use-editable-vfx";
import { useEditor } from "../store";

/**
 * Anything the on-player transform chrome can edit: intrinsic size +
 * current transform + a type-agnostic updater.
 */
export type EditableTransformTarget = {
  id: string;
  width: number;
  height: number;
  /** Raw partial transform fields (for resolveTransform on drag start). */
  transformSource: Partial<Transform>;
  transform: Transform;
  updateTransform: (patch: Partial<Transform>, live?: boolean) => void;
};

/**
 * Active transformable selection under the playhead (b-roll, VFX, …).
 * Add new kinds here as they gain transforms — the overlay stays generic.
 */
export function useEditableTransformTarget(): EditableTransformTarget | null {
  const editableVfx = useEditableVfx();
  const editableBRoll = useEditableBRoll();
  const updateVfxTransform = useEditor((s) => s.updateVfxTransform);
  const updateBRollTransform = useEditor((s) => s.updateBRollTransform);

  if (editableVfx) {
    const { clip, transform } = editableVfx;
    return {
      id: clip.id,
      width: clip.width,
      height: clip.height,
      transformSource: {
        scale: clip.scale,
        offsetX: clip.offsetX,
        offsetY: clip.offsetY,
        rotation: clip.rotation,
      },
      transform,
      updateTransform: (patch, live) =>
        updateVfxTransform(clip.id, patch, live),
    };
  }

  if (editableBRoll) {
    const { clip, transform } = editableBRoll;
    return {
      id: clip.id,
      width: clip.width,
      height: clip.height,
      transformSource: clip,
      transform,
      updateTransform: (patch, live) =>
        updateBRollTransform(clip.id, patch, live),
    };
  }

  return null;
}
