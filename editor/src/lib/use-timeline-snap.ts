import { useMemo } from "react";
import { cutsToKeepRegions } from "@src/lib/timeline/source-timeline";

import { EMPTY_CAPTIONS, EMPTY_CUTS } from "./empty";
import { maybeSnapTimelineSec } from "./snap";
import { useEditor } from "../store";

/** Captions + keep regions for timeline edge snapping. */
export function useTimelineSnap() {
  const captions = useEditor((s) => s.transcript?.captions ?? EMPTY_CAPTIONS);
  const cuts = useEditor((s) => s.config?.cuts ?? EMPTY_CUTS);
  const duration = useEditor((s) => s.transcript?.duration ?? 0);

  const keeps = useMemo(
    () => cutsToKeepRegions(cuts, duration),
    [cuts, duration],
  );

  return (
    sec: number,
    shiftKey: boolean,
    edge: "start" | "end" = "start",
  ) => maybeSnapTimelineSec(sec, captions, shiftKey, edge, keeps);
}
