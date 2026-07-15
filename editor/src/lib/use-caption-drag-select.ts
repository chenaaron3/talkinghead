import { useCallback, useRef } from "react";

import { useSelection } from "../selection-store";

type DragState = { start: number; end: number };

function captionIndexFromPoint(
  x: number,
  y: number,
  resolveIndexAtPoint?: (x: number, y: number) => number | null,
): number | null {
  const el = document
    .elementFromPoint(x, y)
    ?.closest("[data-caption-index]");
  if (el) {
    const raw = el.getAttribute("data-caption-index");
    if (raw != null) {
      const index = Number(raw);
      if (Number.isFinite(index)) return index;
    }
  }

  return resolveIndexAtPoint?.(x, y) ?? null;
}

function suppressNextClick() {
  const onClickCapture = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener("click", onClickCapture, true);
  };
  window.addEventListener("click", onClickCapture, true);
}

export function useCaptionDragSelect(
  allCaptionIndices: number[],
  resolveIndexAtPoint?: (x: number, y: number) => number | null,
) {
  const selectCaptionRange = useSelection((s) => s.selectCaptionRange);
  const dragRef = useRef<DragState | null>(null);
  const movedRef = useRef(false);
  const resolveRef = useRef(resolveIndexAtPoint);
  resolveRef.current = resolveIndexAtPoint;

  const applyRange = useCallback(
    (start: number, end: number) => {
      selectCaptionRange(start, end, allCaptionIndices);
    },
    [allCaptionIndices, selectCaptionRange],
  );

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    if (drag && movedRef.current) {
      applyRange(drag.start, drag.end);
      suppressNextClick();
    }
    dragRef.current = null;
    movedRef.current = false;
  }, [applyRange]);

  const onDragStart = useCallback(
    (index: number, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();

      const start = { start: index, end: index };
      dragRef.current = start;
      movedRef.current = false;
      applyRange(index, index);

      const onMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const hit = captionIndexFromPoint(
          ev.clientX,
          ev.clientY,
          resolveRef.current,
        );
        if (hit == null || drag.end === hit) return;
        movedRef.current = true;
        dragRef.current = { start: drag.start, end: hit };
        applyRange(drag.start, hit);
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        endDrag();
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [applyRange, endDrag],
  );

  return { onDragStart };
}
