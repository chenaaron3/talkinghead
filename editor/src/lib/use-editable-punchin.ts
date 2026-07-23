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
  // Derived selectors keep this from re-rendering on every playback frame:
  // `sourceSec` changes per frame, but the boolean it feeds rarely does.
  const index = useSelection((s) =>
    s.selection?.kind === "punchIn" && typeof s.selection.ids[0] === "number"
      ? s.selection.ids[0]
      : null,
  );
  const punchIn = useEditor((s) =>
    index != null ? (s.config?.punchInSegments[index] ?? null) : null,
  );
  const active = useEditor(
    (s) => punchIn != null && isPunchInActiveAt(punchIn, s.sourceSec),
  );

  if (index == null || !punchIn || !active) return null;
  return {
    index,
    punchIn,
    origin: resolvePunchInOrigin(punchIn),
  };
}
