import type { ReactNode } from "react";
import { X } from "lucide-react";

import { primaryId } from "../../lib/selection";
import { useEditableBRoll } from "../../lib/use-editable-broll";
import { vfxTypeLabel } from "../../lib/vfx";
import { useSelection } from "../../selection-store";
import { useEditor } from "../../store";
import { BRollInspector } from "./BRollInspector";
import { CaptionsInspector } from "./CaptionsInspector";
import { ListicleInspector } from "./ListicleInspector";
import { LocationVfxInspector } from "./LocationVfxInspector";
import { MusicInspector } from "./MusicInspector";
import { QuoteVfxInspector } from "./QuoteVfxInspector";
import { SfxInspector } from "./SfxInspector";
import { ShakeVfxInspector } from "./ShakeVfxInspector";
import { TextVfxInspector } from "./TextVfxInspector";
import { ZoomInspector } from "./ZoomInspector";

/**
 * Selection inspector column. Always reserves ~25% of the transcript row
 * so opening/closing a selection does not reflow the words.
 */
export function InspectorPanel() {
  const editableBRoll = useEditableBRoll();
  const selection = useSelection((s) => s.selection);
  const vfx = useEditor((s) => s.config?.vfx);
  const sfx = useEditor((s) => s.config?.sfx);
  const music = useEditor((s) => s.config?.music);
  const punchIns = useEditor((s) => s.config?.punchInSegments);
  const listicleItems = useEditor((s) => s.config?.listicleOverlay?.items);
  const clearSelection = useSelection((s) => s.clearSelection);

  let title: string | null = null;
  let body: ReactNode = null;

  if (selection?.kind === "vfx") {
    const id = primaryId(selection);
    const clip =
      typeof id === "string" ? vfx?.find((c) => c.id === id) : undefined;
    if (clip?.type === "location") {
      title = vfxTypeLabel(clip.type);
      body = <LocationVfxInspector clip={clip} />;
    } else if (clip?.type === "shake") {
      title = vfxTypeLabel(clip.type);
      body = <ShakeVfxInspector clip={clip} />;
    } else if (clip?.type === "quote") {
      title = vfxTypeLabel(clip.type);
      body = <QuoteVfxInspector clip={clip} />;
    } else if (clip?.type === "text") {
      title = vfxTypeLabel(clip.type);
      body = <TextVfxInspector clip={clip} />;
    }
  } else if (editableBRoll) {
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
  } else if (selection?.kind === "music") {
    if (music) {
      title = "Music";
      body = <MusicInspector clip={music} />;
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
  } else if (selection?.kind === "captions") {
    title = "Captions";
    body = <CaptionsInspector />;
  }

  return (
    <aside
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-panel"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {title && body ? (
        <>
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
          <div className="min-h-0 min-w-0 flex-1 overflow-auto px-3 py-3">
            <div className="w-full min-w-0 max-w-full">{body}</div>
          </div>
        </>
      ) : null}
    </aside>
  );
}
