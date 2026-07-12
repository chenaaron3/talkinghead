import { useEffect, useState, type MouseEvent } from "react";
import type { BRollClip } from "@src/lib/types";
import type { FlatWord } from "../../lib/captions";
import { useEditor } from "../../store";

const NO_BROLLS: BRollClip[] = [];

type ResizeState = {
  id: string;
  edge: "start" | "end";
};

export function useBRollResize() {
  const bRolls = useEditor((s) => s.props?.bRolls ?? NO_BROLLS);
  const seek = useEditor((s) => s.seek);
  const selectBRoll = useEditor((s) => s.selectBRoll);
  const updateBRollRange = useEditor((s) => s.updateBRollRange);
  const beginGesture = useEditor((s) => s.beginGesture);

  const [resize, setResize] = useState<ResizeState | null>(null);

  useEffect(() => {
    if (!resize) return;
    const onUp = () => setResize(null);
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [resize]);

  const snapToWord = (word: FlatWord) => {
    if (!resize) return;
    const clip = bRolls.find((c) => c.id === resize.id);
    if (!clip) return;

    if (resize.edge === "start") {
      const start = word.startFrame;
      const end = Math.max(start + 1, clip.endFrame);
      updateBRollRange(clip.id, start, end, true);
      seek(start);
    } else {
      const end = word.endFrame;
      const start = Math.min(clip.startFrame, end - 1);
      updateBRollRange(clip.id, start, Math.max(start + 1, end), true);
      seek(Math.max(start, end - 1));
    }
  };

  const startResize = (
    e: MouseEvent,
    clip: BRollClip,
    edge: "start" | "end",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    beginGesture();
    selectBRoll(clip.id);
    setResize({ id: clip.id, edge });
    seek(
      edge === "start"
        ? clip.startFrame
        : Math.max(clip.startFrame, clip.endFrame - 1),
    );
  };

  return { resize, startResize, snapToWord };
}
