import { useEffect, useState, type MouseEvent } from "react";
import type { SourceBRoll } from "@src/lib/types";
import type { FlatCaption } from "../../lib/captions";
import { useEditor } from "../../store";

type ResizeState = {
  id: string;
  edge: "start" | "end";
};

export function useBRollResize() {
  const bRolls = useEditor((s) => s.config?.bRolls ?? []);
  const seekSource = useEditor((s) => s.seekSource);
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

  const snapToCaption = (caption: FlatCaption) => {
    if (!resize) return;
    const clip = bRolls.find((c) => c.id === resize.id);
    if (!clip) return;

    if (resize.edge === "start") {
      const start = caption.start;
      const end = Math.max(start + 0.04, clip.end);
      updateBRollRange(clip.id, start, end, true);
      seekSource(start);
    } else {
      const end = caption.end;
      const start = Math.min(clip.start, end - 0.04);
      updateBRollRange(clip.id, start, Math.max(start + 0.04, end), true);
      seekSource(end);
    }
  };

  const startResize = (
    e: MouseEvent,
    clip: SourceBRoll,
    edge: "start" | "end",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    beginGesture();
    selectBRoll(clip.id);
    setResize({ id: clip.id, edge });
    seekSource(edge === "start" ? clip.start : clip.end);
  };

  return { resize, startResize, snapToCaption };
}
