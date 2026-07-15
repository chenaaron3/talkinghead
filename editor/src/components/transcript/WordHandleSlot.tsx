import { RangeHandle } from "./RangeHandle";
import type { HandleConfig } from "../../lib/active-range";

export type { HandleConfig } from "../../lib/active-range";

type Props = {
  edge: "start" | "end";
  handle?: HandleConfig | null;
};

/** ~half a word space per side; two adjacent slots ≈ one natural space. */
const SLOT_CLASS =
  "inline-flex w-[0.185em] shrink-0 items-end justify-center align-baseline";

/** Fixed-width margin that becomes a resize handle without shifting layout. */
export function WordHandleSlot({ edge, handle }: Props) {
  return (
    <span className={SLOT_CLASS} aria-hidden={!handle}>
      {handle ? (
        <RangeHandle
          edge={edge}
          kind={handle.kind}
          onMouseDown={handle.onMouseDown}
          inset
        />
      ) : null}
    </span>
  );
}
