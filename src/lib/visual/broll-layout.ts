/** Layout math for b-roll contain-fit + transform snapping (composition space). */

export function containSize(
  natW: number,
  natH: number,
  compW: number,
  compH: number,
): { w: number; h: number } {
  if (natW <= 0 || natH <= 0) return { w: compW, h: compH };
  const s = Math.min(compW / natW, compH / natH);
  return { w: natW * s, h: natH * s };
}

export type SnapGuide = {
  orientation: "x" | "y";
  /** Position in composition pixels. */
  pos: number;
};

export type SnapResult = {
  offsetX: number;
  offsetY: number;
  guides: SnapGuide[];
};

const SNAP_PX = 28;

/**
 * Snap image center offsets so the box aligns to frame center or edges.
 * Offsets are normalized (fraction of composition size, center-origin).
 * `boxW`/`boxH` are the unscaled contain-fit size; `scale` is applied for edges.
 */
export function snapBRollOffset(args: {
  offsetX: number;
  offsetY: number;
  boxW: number;
  boxH: number;
  scale: number;
  compW: number;
  compH: number;
  thresholdPx?: number;
}): SnapResult {
  const {
    boxW,
    boxH,
    scale,
    compW,
    compH,
    thresholdPx = SNAP_PX,
  } = args;
  let { offsetX, offsetY } = args;
  const guides: SnapGuide[] = [];

  const w = boxW * scale;
  const h = boxH * scale;
  const cx = compW / 2 + offsetX * compW;
  const cy = compH / 2 + offsetY * compH;

  const xTargets: { pos: number; centerAt: number }[] = [
    { pos: compW / 2, centerAt: compW / 2 }, // frame center
    { pos: 0, centerAt: w / 2 }, // left edge
    { pos: compW, centerAt: compW - w / 2 }, // right edge
  ];
  const yTargets: { pos: number; centerAt: number }[] = [
    { pos: compH / 2, centerAt: compH / 2 },
    { pos: 0, centerAt: h / 2 },
    { pos: compH, centerAt: compH - h / 2 },
  ];

  let bestX: { dist: number; offsetX: number; guide: number } | null = null;
  for (const t of xTargets) {
    const dist = Math.abs(cx - t.centerAt);
    if (dist <= thresholdPx && (!bestX || dist < bestX.dist)) {
      bestX = {
        dist,
        offsetX: (t.centerAt - compW / 2) / compW,
        guide: t.pos,
      };
    }
  }
  if (bestX) {
    offsetX = bestX.offsetX;
    guides.push({ orientation: "x", pos: bestX.guide });
  }

  let bestY: { dist: number; offsetY: number; guide: number } | null = null;
  for (const t of yTargets) {
    const dist = Math.abs(cy - t.centerAt);
    if (dist <= thresholdPx && (!bestY || dist < bestY.dist)) {
      bestY = {
        dist,
        offsetY: (t.centerAt - compH / 2) / compH,
        guide: t.pos,
      };
    }
  }
  if (bestY) {
    offsetY = bestY.offsetY;
    guides.push({ orientation: "y", pos: bestY.guide });
  }

  return { offsetX, offsetY, guides };
}

/** Snap scale so the scaled box width or height matches the frame edge. */
export function snapBRollScale(args: {
  scale: number;
  boxW: number;
  boxH: number;
  compW: number;
  compH: number;
  thresholdPx?: number;
}): number {
  const { boxW, boxH, compW, compH, thresholdPx = SNAP_PX } = args;
  let { scale } = args;
  if (boxW <= 0 || boxH <= 0) return scale;

  const candidates = [compW / boxW, compH / boxH, 1];
  let best = scale;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dist = Math.abs(scale * boxW - c * boxW); // compare via width delta
    const distH = Math.abs(scale * boxH - c * boxH);
    const d = Math.min(dist, distH);
    if (d <= thresholdPx && d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}
