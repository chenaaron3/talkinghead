import { useEffect, useRef, useState } from "react";
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "@src/lib/constants";
import {
  containSize,
  snapBRollOffset,
  snapBRollScale,
  type SnapGuide,
} from "@src/lib/broll-layout";
import {
  clampBRollScale,
  resolveTransform,
  type Transform,
} from "../../lib/broll";
import { useEditableBRoll } from "../../lib/use-editable-broll";
import { useEditor } from "../../store";

type DragMode =
  | { kind: "move"; startX: number; startY: number; origin: Transform }
  | { kind: "scale"; startDist: number; origin: Transform }
  | { kind: "rotate"; startAngle: number; origin: Transform };

function useImageSize(src: string | undefined): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!src) {
      setSize(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      if (!cancelled) setSize(null);
    };
    img.src = src.startsWith("/") ? src : `/${src}`;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return size;
}

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
 * Only mounts when a b-roll is selected and visible under the playhead.
 */
export function BRollTransformOverlay({
  onDraggingChange,
}: {
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const editable = useEditableBRoll();
  const updateBRollTransform = useEditor((s) => s.updateBRollTransform);
  const beginGesture = useEditor((s) => s.beginGesture);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode | null>(null);
  const clipIdRef = useRef<string | null>(null);
  const boxRef = useRef<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const imgSize = useImageSize(editable?.clip.src);

  clipIdRef.current = editable?.clip.id ?? null;
  const base = imgSize
    ? containSize(
        imgSize.w,
        imgSize.h,
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
      const clipId = clipIdRef.current;
      const box = boxRef.current;
      if (!drag || !root || !clipId || !box) return;
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
        updateBRollTransform(
          clipId,
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
        updateBRollTransform(clipId, { scale }, true);
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
      updateBRollTransform(clipId, { rotation }, true);
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
  }, [dragging, updateBRollTransform]);

  if (!editable || !imgSize || !base) return null;

  const t = editable.transform;
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
    const origin = resolveTransform(editable.clip);
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
