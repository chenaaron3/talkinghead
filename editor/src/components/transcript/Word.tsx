import { useEffect, useState } from "react";
import type { SourceBRoll } from "@src/lib/types";
import type { FlatCaption } from "../../lib/captions";
import { useEditor, type Asset } from "../../store";

function brollCoveringId(
  bRolls: SourceBRoll[],
  caption: FlatCaption,
): string | undefined {
  return bRolls.find(
    (c) => caption.start < c.end && caption.end > c.start,
  )?.id;
}

type Props = {
  caption: FlatCaption;
  insideHighlight: boolean;
  isResizing: boolean;
  onResizeEnter?: () => void;
};

export function Word({
  caption,
  insideHighlight,
  isResizing,
  onResizeEnter,
}: Props) {
  const sourceSec = useEditor((s) => s.sourceSec);
  const bRolls = useEditor((s) => s.config?.bRolls ?? []);
  const seekSource = useEditor((s) => s.seekSource);
  const selectBRoll = useEditor((s) => s.selectBRoll);
  const setCaptionText = useEditor((s) => s.setCaptionText);
  const setCaptionEmphasis = useEditor((s) => s.setCaptionEmphasis);
  const placeBRollOnCaption = useEditor((s) => s.placeBRollOnCaption);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(caption.text);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const active =
    sourceSec >= caption.start && sourceSec < caption.end;

  if (editing) {
    return (
      <input
        className="m-0 inline rounded-sm bg-panel-2 px-0.5 py-px font-[inherit] text-[inherit] leading-[inherit] text-[#e8eaef] outline outline-2 outline-accent"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setCaptionText(caption, draft.trim() || caption.text);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setCaptionText(caption, draft.trim() || caption.text);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        size={Math.max(2, draft.length + 1)}
      />
    );
  }

  return (
    <>
      <span
        className={[
          "inline cursor-text border-b-2 border-transparent py-[0.12em] transition-colors",
          active && !insideHighlight ? "bg-accent/20 border-accent" : "",
          active && insideHighlight ? "bg-black/10" : "",
          !insideHighlight ? "hover:bg-accent/15" : "hover:bg-broll/50",
          caption.emphasis === "positive" ? "font-semibold text-[#00e676]" : "",
          caption.emphasis === "negative" ? "font-semibold text-[#ff5252]" : "",
          isResizing ? "cursor-ew-resize" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onMouseEnter={() => {
          if (isResizing) onResizeEnter?.();
        }}
        onClick={(e) => {
          e.stopPropagation();
          seekSource(caption.start);
          const coverId = brollCoveringId(bRolls, caption);
          if (coverId) selectBRoll(coverId);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setDraft(caption.text);
          setEditing(true);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/x-broll-asset")) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          const raw = e.dataTransfer.getData("application/x-broll-asset");
          if (!raw) return;
          placeBRollOnCaption(JSON.parse(raw) as Asset, caption);
        }}
        title={`${caption.text}  ${caption.start.toFixed(2)}–${caption.end.toFixed(2)}s`}
      >
        {caption.text}{" "}
      </span>

      {menu ? (
        <div
          className="fixed z-50 min-w-[140px] rounded-lg border border-border bg-panel-2 p-1 shadow-xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {(
            [
              ["Emphasis: positive", "positive"],
              ["Emphasis: negative", "negative"],
              ["Clear emphasis", undefined],
            ] as const
          ).map(([label, value]) => (
            <button
              key={label}
              type="button"
              className="block w-full rounded px-2.5 py-2 text-left hover:bg-[#3d4a66]"
              onClick={() => {
                setCaptionEmphasis(caption, value);
                setMenu(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
