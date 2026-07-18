import type { ReactNode } from "react";
import { X } from "lucide-react";

import { useEditableBRoll } from "../../lib/use-editable-broll";
import { primaryId } from "../../lib/selection";
import { useSelection } from "../../selection-store";
import { useEditor } from "../../store";
import { BRollInspector } from "./BRollInspector";
import { SfxInspector } from "./SfxInspector";

/**
 * Generic selection inspector overlay. Sits on the right edge of the transcript
 * panel (full height).
 */
export function InspectorPanel() {
  const editableBRoll = useEditableBRoll();
  const selection = useSelection((s) => s.selection);
  const sfx = useEditor((s) => s.config?.sfx);
  const clearSelection = useSelection((s) => s.clearSelection);

  let title: string | null = null;
  let body: ReactNode = null;

  if (editableBRoll) {
    title = "B-roll";
    body = (
      <BRollInspector
        clip={editableBRoll.clip}
        transform={editableBRoll.transform}
      />
    );
  } else if (selection?.kind === "sfx") {
    const id = primaryId(selection);
    const clip =
      typeof id === "string" ? sfx?.find((c) => c.id === id) : undefined;
    if (clip) {
      title = "SFX";
      body = <SfxInspector clip={clip} />;
    }
  }

  if (!title || !body) return null;

  return (
    <aside
      className="absolute inset-y-0 right-0 z-20 flex w-[220px] flex-col border-l border-border bg-panel shadow-[-8px_0_24px_rgba(0,0,0,0.35)]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-xs font-medium tracking-wide text-[#e8eaef]">
          {title}
        </h2>
        <button
          type="button"
          className="rounded p-0.5 text-muted hover:bg-panel-2 hover:text-[#e8eaef]"
          aria-label="Close inspector"
          onClick={() => clearSelection()}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">{body}</div>
    </aside>
  );
}
