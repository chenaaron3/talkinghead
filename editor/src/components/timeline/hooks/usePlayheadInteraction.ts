import { useCallback, useRef, useState } from "react";
import { setTimelineScrubbing } from "../../../store";
import { LABEL_OFFSET } from "../constants";

type Options = {
  contentRef: React.RefObject<HTMLDivElement | null>;
  duration: number;
  pxPerSec: number;
  seekSource: (sec: number) => void;
};

export function usePlayheadInteraction({
  contentRef,
  duration,
  pxPerSec,
  seekSource,
}: Options) {
  const [hoverSec, setHoverSec] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const skipClickRef = useRef(false);

  const clientXToSec = useCallback(
    (clientX: number): number | null => {
      const content = contentRef.current;
      if (!content) return null;
      const rect = content.getBoundingClientRect();
      const x = clientX - rect.left - LABEL_OFFSET;
      const sec = x / pxPerSec;
      if (sec < 0 || sec > duration) return null;
      return sec;
    },
    [contentRef, duration, pxPerSec],
  );

  const onMouseMove = useCallback(
    (clientX: number) => {
      if (scrubbing) return;
      setHoverSec(clientXToSec(clientX));
    },
    [scrubbing, clientXToSec],
  );

  const onMouseLeave = useCallback(() => {
    if (!scrubbing) setHoverSec(null);
  }, [scrubbing]);

  const startScrub = useCallback(
    (clientX: number) => {
      skipClickRef.current = true;
      setScrubbing(true);
      setTimelineScrubbing(true);
      setHoverSec(null);

      const sec = clientXToSec(clientX);
      if (sec != null) seekSource(sec);

      const onMove = (ev: MouseEvent) => {
        const next = clientXToSec(ev.clientX);
        if (next != null) seekSource(next);
      };

      const onUp = () => {
        setScrubbing(false);
        setTimelineScrubbing(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [clientXToSec, seekSource],
  );

  const onClick = useCallback(
    (clientX: number) => {
      if (skipClickRef.current) {
        skipClickRef.current = false;
        return;
      }
      const sec = hoverSec ?? clientXToSec(clientX);
      if (sec != null) seekSource(sec);
    },
    [hoverSec, clientXToSec, seekSource],
  );

  return {
    hoverSec,
    scrubbing,
    onMouseMove,
    onMouseLeave,
    onClick,
    startScrub,
  };
}
