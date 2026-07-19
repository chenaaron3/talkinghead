import { useEffect, useRef, useState } from "react";
import { useEditablePunchIn } from "../../lib/use-editable-punchin";
import { useEditor } from "../../store";

function clientToOrigin(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { originX: number; originY: number } {
  return {
    originX: Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width),
    ),
    originY: Math.min(
      1,
      Math.max(0, (clientY - rect.top) / rect.height),
    ),
  };
}

/**
 * HTML overlay on the Remotion player: draggable focal-point dot for zoom.
 * Only mounts when a punch-in is selected and active under the playhead.
 */
export function PunchInOriginOverlay({
  onDraggingChange,
}: {
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const editable = useEditablePunchIn();
  const updatePunchIn = useEditor((s) => s.updatePunchIn);
  const beginGesture = useEditor((s) => s.beginGesture);
  const rootRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  indexRef.current = editable?.index ?? null;

  useEffect(() => {
    onDraggingChange?.(dragging);
  }, [dragging, onDraggingChange]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const root = rootRef.current;
      const index = indexRef.current;
      if (!root || index == null) return;
      const rect = root.getBoundingClientRect();
      const { originX, originY } = clientToOrigin(e.clientX, e.clientY, rect);
      updatePunchIn(index, { originX, originY }, true);
    };

    const onUp = () => {
      setDragging(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, updatePunchIn]);

  if (!editable) return null;

  const { originX, originY } = editable.origin;

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    beginGesture();
    setDragging(true);
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const next = clientToOrigin(e.clientX, e.clientY, rect);
    updatePunchIn(editable.index, next, true);
  };

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-10">
      <button
        type="button"
        aria-label="Zoom focal point"
        className="pointer-events-auto absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-white bg-purple-400 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
        style={{
          left: `${originX * 100}%`,
          top: `${originY * 100}%`,
        }}
        onPointerDown={startDrag}
      />
    </div>
  );
}
