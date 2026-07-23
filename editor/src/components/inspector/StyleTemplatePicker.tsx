import { useState } from "react";

import {
  resolveCaptionFont,
  type CaptionStyle,
} from "@src/lib/captions/style";

import { cn } from "../../lib/utils";
import { useEditor } from "../../store";
import { CaptionTemplatePreview } from "./CaptionTemplatePreview";

export type StyleTemplateChip = {
  id: string;
  label: string;
  style: CaptionStyle;
};

/** Shared template preview + sidescroll used by Captions, Quote, and Title inspectors. */
export function StyleTemplatePicker({
  templates,
  value,
  onChange,
  /** When set, used as the idle preview (e.g. live episode style). */
  fallbackStyle,
}: {
  templates: StyleTemplateChip[];
  value: string | null;
  onChange: (id: string) => void;
  fallbackStyle?: CaptionStyle;
}) {
  const [hovered, setHovered] = useState<StyleTemplateChip | null>(null);
  const selected = templates.find((t) => t.id === value) ?? null;
  const previewStyle =
    hovered?.style ?? selected?.style ?? fallbackStyle ?? null;
  const previewLabel = hovered?.label ?? selected?.label ?? null;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-1.5">
      <span className="text-[10px] font-medium tracking-wide text-muted uppercase">
        Template
      </span>

      <div className="overflow-hidden rounded-lg border border-border">
        {previewStyle ? (
          <>
            <CaptionTemplatePreview
              style={previewStyle}
              playing={hovered != null}
            />
            <div className="border-t border-border bg-panel-2 px-2 py-1.5 text-center text-[10px] text-muted">
              {previewLabel ?? "Current"}
              {hovered && hovered.id !== value ? (
                <span className="text-muted/70"> · preview</span>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex h-[128px] items-center justify-center bg-panel-2 text-[11px] text-muted">
            Hover a template
          </div>
        )}
      </div>

      <div className="min-w-0 overflow-x-auto">
        <div className="flex w-max gap-2 pb-1">
          {templates.map((template) => {
            const selectedChip = template.id === value;
            const face = resolveCaptionFont(template.style.fontFamily);
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  useEditor.getState().beginGesture();
                  onChange(template.id);
                }}
                onMouseEnter={() => setHovered(template)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(template)}
                onBlur={() => setHovered(null)}
                className={cn(
                  "flex h-14 w-24 shrink-0 flex-col items-center justify-center rounded-lg border px-2 text-center transition-colors",
                  selectedChip
                    ? "border-accent bg-accent/15"
                    : "border-border bg-panel-2 hover:bg-panel-2/80",
                )}
                title={template.label}
              >
                <span
                  className="max-w-full truncate text-[11px] leading-tight"
                  style={{
                    color: template.style.color,
                    fontFamily: face.family,
                    fontWeight: face.weight,
                  }}
                >
                  Aa
                </span>
                <span className="mt-1 max-w-full truncate text-[9px] text-muted">
                  {template.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
