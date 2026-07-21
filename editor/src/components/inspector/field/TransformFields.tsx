import { useState } from "react";
import { ChevronRight } from "lucide-react";

import {
  BROLL_SCALE_MAX,
  BROLL_SCALE_MIN,
  TRANSFORM_DEFAULTS,
  type Transform,
} from "../../../lib/broll";
import { cn } from "../../../lib/utils";
import { useEditor } from "../../../store";
import { Button } from "../../ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../ui/collapsible";

import { NumberField } from "./NumberField";
import { SliderField } from "./SliderField";

export function TransformFields({
  transform,
  onPatch,
  defaultOpen = false,
}: {
  transform: Transform;
  onPatch: (partial: Partial<Transform>, live: boolean) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="overflow-hidden rounded-lg border border-border"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 bg-panel-2 px-2 py-1.5 text-left hover:bg-panel-2/80">
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#e8eaef]">
          Transform
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-4 border-t border-border p-2.5">
          <SliderField
            label="Scale"
            value={transform.scale}
            min={BROLL_SCALE_MIN}
            max={BROLL_SCALE_MAX}
            step={0.01}
            display={`${transform.scale.toFixed(2)}×`}
            onLiveChange={(scale) => onPatch({ scale }, true)}
            onCommit={(scale) => onPatch({ scale }, true)}
          />

          <NumberField
            label="Offset X"
            value={transform.offsetX}
            step={0.01}
            onLiveChange={(offsetX) => onPatch({ offsetX }, true)}
          />

          <NumberField
            label="Offset Y"
            value={transform.offsetY}
            step={0.01}
            onLiveChange={(offsetY) => onPatch({ offsetY }, true)}
          />

          <SliderField
            label="Rotation"
            value={((transform.rotation % 360) + 360 + 180) % 360 - 180}
            min={-180}
            max={180}
            step={1}
            display={`${Math.round(transform.rotation)}°`}
            onLiveChange={(rotation) => onPatch({ rotation }, true)}
            onCommit={(rotation) => onPatch({ rotation }, true)}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 w-full"
            onClick={() => {
              useEditor.getState().beginGesture();
              onPatch({ ...TRANSFORM_DEFAULTS }, false);
            }}
          >
            Reset transform
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
