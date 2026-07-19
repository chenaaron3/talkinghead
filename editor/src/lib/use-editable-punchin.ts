import { useSelection } from "../selection-store";
import { useEditor } from "../store";
import {
  isPunchInActiveAt,
  resolvePunchInOrigin,
} from "./punchin";
import type { SourcePunchIn } from "@src/lib/types";

export type EditablePunchIn = {
  index: number;
  punchIn: SourcePunchIn;
  origin: { originX: number; originY: number };
};

/** Selected punch-in that is currently active under the playhead. */
export function useEditablePunchIn(): EditablePunchIn | null {
  const selection = useSelection((s) => s.selection);
  const sourceSec = useEditor((s) => s.sourceSec);
  const punchIns = useEditor((s) => s.config?.punchInSegments);

  if (selection?.kind !== "punchIn") return null;
  const index = selection.ids[0];
  if (typeof index !== "number") return null;
  const punchIn = punchIns?.[index];
  if (!punchIn || !isPunchInActiveAt(punchIn, sourceSec)) return null;
  return {
    index,
    punchIn,
    origin: resolvePunchInOrigin(punchIn),
  };
}
