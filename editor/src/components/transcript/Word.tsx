import { useEffect, useState } from "react";
import type { BRollClip } from "@src/lib/types";
import type { FlatWord } from "../../lib/captions";
import { useEditor, type Asset } from "../../store";

const NO_BROLLS: BRollClip[] = [];

function brollCoveringId(
  bRolls: BRollClip[],
  word: FlatWord,
): string | undefined {
  return bRolls.find(
    (c) => word.startFrame < c.endFrame && word.endFrame > c.startFrame,
  )?.id;
}

type Props = {
  word: FlatWord;
  insideHighlight: boolean;
  isResizing: boolean;
  onResizeEnter?: () => void;
};

export function Word({
  word,
  insideHighlight,
  isResizing,
  onResizeEnter,
}: Props) {
  const frame = useEditor((s) => s.frame);
  const bRolls = useEditor((s) => s.props?.bRolls ?? NO_BROLLS);
  const seek = useEditor((s) => s.seek);
  const selectBRoll = useEditor((s) => s.selectBRoll);
  const setWordText = useEditor((s) => s.setWordText);
  const setWordEmphasis = useEditor((s) => s.setWordEmphasis);
  const placeBRollOnWord = useEditor((s) => s.placeBRollOnWord);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(word.text);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const active =
    frame >= word.startFrame &&
    frame < Math.max(word.endFrame, word.startFrame + 1);

  if (editing) {
    return (
      <input
        className="m-0 inline rounded-sm bg-panel-2 px-0.5 py-px font-[inherit] text-[inherit] leading-[inherit] text-[#e8eaef] outline outline-2 outline-accent"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setWordText(word, draft.trim() || word.text);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setWordText(word, draft.trim() || word.text);
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
          word.emphasis === "positive" ? "font-semibold text-[#00e676]" : "",
          word.emphasis === "negative" ? "font-semibold text-[#ff5252]" : "",
          isResizing ? "cursor-ew-resize" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onMouseEnter={() => {
          if (isResizing) onResizeEnter?.();
        }}
        onClick={(e) => {
          e.stopPropagation();
          seek(word.startFrame);
          const coverId = brollCoveringId(bRolls, word);
          if (coverId) selectBRoll(coverId);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setDraft(word.text);
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
          placeBRollOnWord(JSON.parse(raw) as Asset, word);
        }}
        title={`${word.text}  ${word.startFrame}–${word.endFrame}`}
      >
        {word.text}{" "}
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
                setWordEmphasis(word, value);
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
