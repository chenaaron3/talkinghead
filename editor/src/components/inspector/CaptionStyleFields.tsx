import { Minus, Plus } from "lucide-react";

import { useEditor } from "../../store";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  InspectorCollapsible,
  NumberField,
  SliderField,
} from "./field";

import type { CaptionStyleOverrides } from "@src/lib/captions/style";

/** Minimal editable caption overrides (template owns the rest). */
export function CaptionStyleFields({
  overrides,
  resolvedFill,
  resolvedY,
  resolvedFontSize,
  resolvedCaptionsAtATime,
  onPatch,
  defaultOpen = false,
  showCaptionsAtATime = true,
}: {
  overrides: CaptionStyleOverrides;
  resolvedFill: string;
  resolvedY: number;
  resolvedFontSize: number;
  resolvedCaptionsAtATime?: number;
  onPatch: (partial: CaptionStyleOverrides, live?: boolean) => void;
  defaultOpen?: boolean;
  /** Caption/quote grouping; text VFX always show the full phrase. */
  showCaptionsAtATime?: boolean;
}) {
  const words = resolvedCaptionsAtATime ?? 1;
  const fill = overrides.fill ?? resolvedFill;

  return (
    <InspectorCollapsible title="Style" defaultOpen={defaultOpen}>
      <div
        className={
          showCaptionsAtATime
            ? "grid grid-cols-2 gap-2"
            : "grid grid-cols-1 gap-2"
        }
      >
        <NumberField
          label="Size"
          value={resolvedFontSize}
          step={1}
          min={24}
          max={120}
          onLiveChange={(fontSize) => onPatch({ fontSize }, true)}
        />
        {showCaptionsAtATime ? (
          <div className="flex flex-col gap-1">
            <Label>Words / group</Label>
            <div className="flex h-8 items-center overflow-hidden rounded-md border border-border bg-panel-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 rounded-none px-0"
                disabled={words <= 1}
                aria-label="Fewer words per caption"
                onClick={() => {
                  useEditor.getState().beginGesture();
                  onPatch({ captionsAtATime: words - 1 });
                }}
              >
                <Minus className="size-3.5" />
              </Button>
              <span className="min-w-0 flex-1 select-none text-center text-xs text-[#e8eaef]">
                {words}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 rounded-none px-0"
                disabled={words >= 8}
                aria-label="More words per caption"
                onClick={() => {
                  useEditor.getState().beginGesture();
                  onPatch({ captionsAtATime: words + 1 });
                }}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label>Fill</Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            className="h-8 w-10 cursor-pointer p-1"
            value={fill}
            onFocus={() => useEditor.getState().beginGesture()}
            onChange={(e) => onPatch({ fill: e.target.value }, true)}
          />
          <Input
            type="text"
            className="h-8 flex-1"
            value={fill}
            onFocus={() => useEditor.getState().beginGesture()}
            onChange={(e) => onPatch({ fill: e.target.value }, true)}
          />
        </div>
      </div>

      <SliderField
        label="Y (safe area)"
        value={resolvedY}
        min={0}
        max={1}
        step={0.01}
        display={resolvedY.toFixed(2)}
        onLiveChange={(y) => onPatch({ y }, true)}
        onCommit={(y) => onPatch({ y }, true)}
      />
    </InspectorCollapsible>
  );
}
