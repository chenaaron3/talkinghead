import { useMemo } from "react";

import {
  findScissorPauses,
  type InterWordPause,
} from "@src/lib/timeline/inter-word-gaps";
import { useEditor } from "../../../store";

export type ScissorGhosts = {
  active: boolean;
  /** Ghost pause to render immediately before this caption, if any. */
  beforeCaption: (captionIndex: number) => InterWordPause | null;
  trailing: InterWordPause | null;
};

export function useScissorGhosts(): ScissorGhosts {
  const config = useEditor((s) => s.config);
  const transcript = useEditor((s) => s.transcript);
  const mode = useEditor((s) => s.mode);
  const active = mode === "scissor";

  const byCaption = useMemo(() => {
    const map = new Map<number, InterWordPause>();
    if (!active || !config || !transcript) {
      return { map, trailing: null as InterWordPause | null };
    }

    const pauses = findScissorPauses({
      captions: transcript.captions,
      cuts: config.cuts,
      durationSec: transcript.duration,
    });

    let trailing: InterWordPause | null = null;
    for (const pause of pauses) {
      if (pause.kind === "trailing") {
        trailing = pause;
        continue;
      }
      if (pause.beforeCaptionIndex != null) {
        map.set(pause.beforeCaptionIndex, pause);
      }
    }
    return { map, trailing };
  }, [active, config, transcript]);

  return {
    active,
    beforeCaption: (captionIndex) => byCaption.map.get(captionIndex) ?? null,
    trailing: byCaption.trailing,
  };
}
