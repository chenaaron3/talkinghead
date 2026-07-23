import { Minus, Plus } from "lucide-react";

import {
  CAPTION_ANIMATIONS,
  CAPTION_BACKDROPS,
  CAPTION_FONT_IDS,
  CAPTION_TEXT_TRANSFORMS,
} from "@src/lib/captions/style";

import { useEditor } from "../../store";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  InspectorCollapsible,
  NumberField,
  SliderField,
  ToggleField,
} from "./field";

import type {
  CaptionAnimation,
  CaptionBackdrop,
  CaptionFontId,
  CaptionStyle,
  CaptionTextTransform,
} from "@src/lib/captions/style";

/** Shared editable caption style controls (episode default + Quote / Text VFX). */
export function CaptionStyleFields({
  style,
  onPatch,
  defaultOpen = false,
}: {
  style: CaptionStyle;
  onPatch: (partial: Partial<CaptionStyle>, live?: boolean) => void;
  defaultOpen?: boolean;
}) {
  const words = style.captionsAtATime;

  return (
    <InspectorCollapsible title="Style" defaultOpen={defaultOpen}>
      <div className="flex flex-col gap-1">
        <Label>Font</Label>
        <select
          className="h-8 rounded-md border border-border bg-panel-2 px-2 text-xs text-[#e8eaef]"
          value={style.fontFamily}
          onFocus={() => useEditor.getState().beginGesture()}
          onChange={(e) =>
            onPatch({ fontFamily: e.target.value as CaptionFontId })
          }
        >
          {CAPTION_FONT_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Size"
          value={style.fontSize}
          step={1}
          min={24}
          max={120}
          onLiveChange={(fontSize) => onPatch({ fontSize }, true)}
        />
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
      </div>

      <div className="flex flex-col gap-1">
        <Label>Color</Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            className="h-8 w-10 cursor-pointer p-1"
            value={style.color}
            onFocus={() => useEditor.getState().beginGesture()}
            onChange={(e) => onPatch({ color: e.target.value }, true)}
          />
          <Input
            type="text"
            className="h-8 flex-1"
            value={style.color}
            onFocus={() => useEditor.getState().beginGesture()}
            onChange={(e) => onPatch({ color: e.target.value }, true)}
          />
        </div>
      </div>

      <SliderField
        label="Y (safe area)"
        value={style.y}
        min={0}
        max={1}
        step={0.01}
        display={style.y.toFixed(2)}
        onLiveChange={(y) => onPatch({ y }, true)}
        onCommit={(y) => onPatch({ y }, true)}
      />

      <div className="flex flex-col gap-1">
        <Label>Animation</Label>
        <select
          className="h-8 rounded-md border border-border bg-panel-2 px-2 text-xs text-[#e8eaef]"
          value={style.animation}
          onFocus={() => useEditor.getState().beginGesture()}
          onChange={(e) =>
            onPatch({ animation: e.target.value as CaptionAnimation })
          }
        >
          {CAPTION_ANIMATIONS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label>Text transform</Label>
        <select
          className="h-8 rounded-md border border-border bg-panel-2 px-2 text-xs text-[#e8eaef]"
          value={style.textTransform}
          onFocus={() => useEditor.getState().beginGesture()}
          onChange={(e) =>
            onPatch({
              textTransform: e.target.value as CaptionTextTransform,
            })
          }
        >
          {CAPTION_TEXT_TRANSFORMS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label>Backdrop</Label>
        <select
          className="h-8 rounded-md border border-border bg-panel-2 px-2 text-xs text-[#e8eaef]"
          value={style.backdrop ?? "none"}
          onFocus={() => useEditor.getState().beginGesture()}
          onChange={(e) =>
            onPatch({ backdrop: e.target.value as CaptionBackdrop })
          }
        >
          {CAPTION_BACKDROPS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      <ToggleField
        label="Split 2 lines"
        checked={style.stack ?? false}
        onCheckedChange={(stack) => onPatch({ stack })}
      />

      <ToggleField
        label="Shadow"
        checked={style.shadow}
        onCheckedChange={(shadow) => onPatch({ shadow })}
      />

      <ToggleField
        label="Stroke"
        checked={style.stroke != null}
        onCheckedChange={(on) =>
          onPatch({
            stroke: on
              ? (style.stroke ?? { width: 10, color: "#000000" })
              : null,
          })
        }
      />

      {style.stroke ? (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <NumberField
              label="Stroke width"
              value={style.stroke.width}
              step={1}
              min={1}
              max={24}
              onLiveChange={(width) =>
                onPatch({ stroke: { ...style.stroke!, width } }, true)
              }
            />
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <Label>Color</Label>
            <Input
              type="color"
              className="h-8 w-10 cursor-pointer p-1"
              value={style.stroke.color}
              onFocus={() => useEditor.getState().beginGesture()}
              onChange={(e) =>
                onPatch(
                  { stroke: { ...style.stroke!, color: e.target.value } },
                  true,
                )
              }
            />
          </div>
        </div>
      ) : null}
    </InspectorCollapsible>
  );
}
