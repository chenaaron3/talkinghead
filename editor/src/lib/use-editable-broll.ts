import { useSelection } from "../selection-store";
import { useEditor } from "../store";
import {
  isBRollActiveAt,
  resolveTransform,
  type Transform,
} from "../lib/broll";
import type { SourceBRoll } from "@src/lib/types";

export type EditableBRoll = {
  clip: SourceBRoll;
  transform: Transform;
};

/** Selected b-roll that is currently visible under the playhead. */
export function useEditableBRoll(): EditableBRoll | null {
  // Derived selectors keep this from re-rendering on every playback frame:
  // `sourceSec` changes per frame, but the boolean it feeds rarely does.
  const id = useSelection((s) =>
    s.selection?.kind === "broll" && typeof s.selection.ids[0] === "string"
      ? s.selection.ids[0]
      : null,
  );
  const clip = useEditor((s) =>
    id != null ? (s.config?.bRolls.find((c) => c.id === id) ?? null) : null,
  );
  const active = useEditor(
    (s) => clip != null && isBRollActiveAt(clip, s.sourceSec),
  );

  if (!clip || !active) return null;
  return { clip, transform: resolveTransform(clip) };
}
