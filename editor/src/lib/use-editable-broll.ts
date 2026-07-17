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
  const selection = useSelection((s) => s.selection);
  const sourceSec = useEditor((s) => s.sourceSec);
  const bRolls = useEditor((s) => s.config?.bRolls);

  if (selection?.kind !== "broll") return null;
  const id = selection.ids[0];
  if (typeof id !== "string") return null;
  const clip = bRolls?.find((c) => c.id === id);
  if (!clip || !isBRollActiveAt(clip, sourceSec)) return null;
  return { clip, transform: resolveTransform(clip) };
}
