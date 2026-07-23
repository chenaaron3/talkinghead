import {
  BROLL_SCALE_MAX,
  BROLL_SCALE_MIN,
  TRANSFORM_DEFAULTS,
  type Transform,
} from "../../../lib/broll";
import { useEditor } from "../../../store";
import { Button } from "../../ui/button";

import { InspectorCollapsible } from "./InspectorCollapsible";
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
  return (
    <InspectorCollapsible title="Transform" defaultOpen={defaultOpen}>
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
    </InspectorCollapsible>
  );
}
