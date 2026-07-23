import { useEffect, useRef, useState } from "react";
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "@src/lib/episode/constants";
import {
  containSize,
  snapBRollOffset,
  snapBRollScale,
  type SnapGuide,
} from "@src/lib/visual/broll-layout";
import {
  clampBRollScale,
  resolveTransform,
  type Transform,
} from "../../lib/broll";
import { useEditableTransformTarget } from "../../lib/use-editable-transform";
import { useEditor } from "../../store";

type DragMode =
  | { kind: "move"; startX: number; startY: number; origin: Transform }
  | { kind: "scale"; startDist: number; origin: Transform }
  | { kind: "rotate"; startAngle: number; origin: Transform };

function clientToComp(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } {
  return {
    x: ((clientX - rect.left) / rect.width) * COMPOSITION_WIDTH,
    y: ((clientY - rect.top) / rect.height) * COMPOSITION_HEIGHT,
  };
}

/**
 * HTML overlay on the Remotion player for drag move / scale / rotate.
 * Works with any selection exposed by `useEditableTransformTarget`.
 */
export function TransformOverlay({
  onDraggingChange,
}: {
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const target = useEditableTransformTarget();
  const beginGesture = useEditor((s) => s.beginGesture);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode | null>(null);
  const targetRef = useRef(target);
  const boxRef = useRef<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [guides, setGuides] = useState<SnapGuide[]>([]);

  targetRef.current = target;
  const base = target
    ? containSize(
        target.width,
        target.height,
        COMPOSITION_WIDTH,
        COMPOSITION_HEIGHT,
      )
    : null;
  boxRef.current = base;

  useEffect(() => {
    onDraggingChange?.(dragging);
  }, [dragging, onDraggingChange]);

  useEffect(() => {
    if (!dragging) {
      setGuides([]);
      return;
    }

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      const root = rootRef.current;
      const current = targetRef.current;
      const box = boxRef.current;
      if (!drag || !root || !current || !box) return;
      const rect = root.getBoundingClientRect();
      const { x, y } = clientToComp(e.clientX, e.clientY, rect);
      const cx =
        COMPOSITION_WIDTH / 2 + drag.origin.offsetX * COMPOSITION_WIDTH;
      const cy =
        COMPOSITION_HEIGHT / 2 + drag.origin.offsetY * COMPOSITION_HEIGHT;

      if (drag.kind === "move") {
        const dx = (x - drag.startX) / COMPOSITION_WIDTH;
        const dy = (y - drag.startY) / COMPOSITION_HEIGHT;
        const rawX = drag.origin.offsetX + dx;
        const rawY = drag.origin.offsetY + dy;
        const snapped = snapBRollOffset({
          offsetX: rawX,
          offsetY: rawY,
          boxW: box.w,
          boxH: box.h,
          scale: drag.origin.scale,
          compW: COMPOSITION_WIDTH,
          compH: COMPOSITION_HEIGHT,
        });
        setGuides(snapped.guides);
        current.updateTransform(
          { offsetX: snapped.offsetX, offsetY: snapped.offsetY },
          true,
        );
        return;
      }

      if (drag.kind === "scale") {
        const dist = Math.hypot(x - cx, y - cy);
        if (drag.startDist < 1) return;
        let scale = clampBRollScale(
          drag.origin.scale * (dist / drag.startDist),
        );
        scale = clampBRollScale(
          snapBRollScale({
            scale,
            boxW: box.w,
            boxH: box.h,
            compW: COMPOSITION_WIDTH,
            compH: COMPOSITION_HEIGHT,
          }),
        );
        setGuides([]);
        current.updateTransform({ scale }, true);
        return;
      }

      const angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
      let delta = angle - drag.startAngle;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      // Snap rotation to 0 / ±45 / ±90
      let rotation = drag.origin.rotation + delta;
      const rotSnap = 45;
      const nearest = Math.round(rotation / rotSnap) * rotSnap;
      if (Math.abs(rotation - nearest) <= 8) rotation = nearest;
      setGuides([]);
      current.updateTransform({ rotation }, true);
    };

    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
      setGuides([]);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  if (!target || !base) return null;

  const t = target.transform;
  const boxW = (base.w / COMPOSITION_WIDTH) * 100;
  const boxH = (base.h / COMPOSITION_HEIGHT) * 100;
  const left = 50 + t.offsetX * 100;
  const top = 50 + t.offsetY * 100;

  const startDrag = (e: React.PointerEvent, mode: DragMode["kind"]) => {
    e.preventDefault();
    e.stopPropagation();
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const { x, y } = clientToComp(e.clientX, e.clientY, rect);
    const origin = resolveTransform(target.transformSource);
    const cx = COMPOSITION_WIDTH / 2 + origin.offsetX * COMPOSITION_WIDTH;
    const cy = COMPOSITION_HEIGHT / 2 + origin.offsetY * COMPOSITION_HEIGHT;
    beginGesture();

    if (mode === "move") {
      dragRef.current = { kind: "move", startX: x, startY: y, origin };
    } else if (mode === "scale") {
      dragRef.current = {
        kind: "scale",
        startDist: Math.max(1, Math.hypot(x - cx, y - cy)),
        origin,
      };
    } else {
      dragRef.current = {
        kind: "rotate",
        startAngle: (Math.atan2(y - cy, x - cx) * 180) / Math.PI,
        origin,
      };
    }
    setDragging(true);
  };

  const handleClass =
    "absolute h-2.5 w-2.5 rounded-sm border border-white bg-accent shadow";

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-10"
    >
      {guides.map((g) =>
        g.orientation === "x" ? (
          <div
            key={`x-${g.pos}`}
            className="absolute top-0 bottom-0 w-px bg-accent/80"
            style={{ left: `${(g.pos / COMPOSITION_WIDTH) * 100}%` }}
          />
        ) : (
          <div
            key={`y-${g.pos}`}
            className="absolute left-0 right-0 h-px bg-accent/80"
            style={{ top: `${(g.pos / COMPOSITION_HEIGHT) * 100}%` }}
          />
        ),
      )}

      <div
        className="pointer-events-auto absolute cursor-move border border-accent/90 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
        style={{
          width: `${boxW}%`,
          height: `${boxH}%`,
          left: `${left}%`,
          top: `${top}%`,
          transform: `translate(-50%, -50%) rotate(${t.rotation}deg) scale(${t.scale})`,
          transformOrigin: "center center",
        }}
        onPointerDown={(e) => startDrag(e, "move")}
      >
        <div
          className="absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-full flex-col items-center"
          style={{ height: 28 }}
        >
          <button
            type="button"
            aria-label="Rotate"
            className="pointer-events-auto mb-1 h-2.5 w-2.5 rounded-full border border-white bg-accent"
            onPointerDown={(e) => startDrag(e, "rotate")}
          />
          <div className="h-full w-px bg-accent/80" />
        </div>

        {(
          [
            ["-left-1 -top-1", "cursor-nwse-resize"],
            ["-right-1 -top-1", "cursor-nesw-resize"],
            ["-left-1 -bottom-1", "cursor-nesw-resize"],
            ["-right-1 -bottom-1", "cursor-nwse-resize"],
          ] as const
        ).map(([pos, cursor]) => (
          <button
            key={pos}
            type="button"
            aria-label="Scale"
            className={`${handleClass} pointer-events-auto ${pos} ${cursor}`}
            onPointerDown={(e) => startDrag(e, "scale")}
          />
        ))}
      </div>
    </div>
  );
}
