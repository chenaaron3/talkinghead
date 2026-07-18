import type { ReactNode } from "react";
import { X } from 'lucide-react';

import { primaryId } from '../../lib/selection';
import { useEditableBRoll } from '../../lib/use-editable-broll';
import { useSelection } from '../../selection-store';
import { useEditor } from '../../store';
import { BRollInspector } from './BRollInspector';
import { ListicleInspector } from './ListicleInspector';
import { SfxInspector } from './SfxInspector';
import { ZoomInspector } from './ZoomInspector';

/**
 * Generic selection inspector overlay. Sits on the right edge of the transcript
 * panel (full height).
 */
export function InspectorPanel() {
  const editableBRoll = useEditableBRoll();
  const selection = useSelection((s) => s.selection);
  const sfx = useEditor((s) => s.config?.sfx);
  const punchIns = useEditor((s) => s.config?.punchInSegments);
  const listicleItems = useEditor((s) => s.config?.listicleOverlay?.items);
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
  } else if (selection?.kind === "punchIn") {
    const index = primaryId(selection);
    const punchIn =
      typeof index === "number" ? punchIns?.[index] : undefined;
    if (punchIn != null && typeof index === "number") {
      title = "Zoom";
      body = <ZoomInspector index={index} punchIn={punchIn} />;
    }
  } else if (selection?.kind === "listicleItem") {
    const index = primaryId(selection);
    const item =
      typeof index === "number" ? listicleItems?.[index] : undefined;
    if (item != null && typeof index === "number") {
      title = "Listicle";
      body = <ListicleInspector index={index} item={item} />;
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
