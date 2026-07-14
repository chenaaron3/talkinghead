import { type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useEditor } from "../../store";

export function TrackLabel({
  label,
  width,
  children,
}: {
  label: string;
  width: number;
  children: ReactNode;
}) {
  return (
    <div className="relative mb-2 h-11">
      <div className="absolute top-0 left-[-72px] flex h-11 w-16 items-center text-[11px] tracking-wide text-muted uppercase">
        {label}
      </div>
      <div
        className="relative h-11 overflow-hidden rounded-md border border-border bg-panel-2"
        style={{ width }}
      >
        {children}
      </div>
    </div>
  );
}

export function Handle({
  side,
  className,
  onMouseDown,
}: {
  side: "left" | "right";
  className?: string;
  onMouseDown: (e: ReactMouseEvent) => void;
}) {
  return (
    <span
      className={`absolute top-0 bottom-0 z-10 w-2.5 cursor-ew-resize touch-none bg-white/35 hover:bg-white/60 ${
        side === "left" ? "left-0" : "right-0"
      } ${className ?? ""}`}
      onMouseDown={onMouseDown}
    />
  );
}

/** Edge-drag helper for timeline range handles (does not move playhead). */
export function useTrackDrag() {
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const beginGesture = useEditor((s) => s.beginGesture);

  const startDrag = (
    e: ReactMouseEvent,
    onMove: (dxSec: number, dxPx: number, shiftKey: boolean) => void,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    beginGesture();
    const startX = e.clientX;
    const onPointerMove = (ev: MouseEvent) => {
      const dxPx = ev.clientX - startX;
      onMove(dxPx / pxPerSec, dxPx, ev.shiftKey);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onUp);
  };

  return { startDrag, pxPerSec };
}
