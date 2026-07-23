import {
  CAPTION_TEMPLATE_LIST,
  resolveCaptionTemplateStyle,
  type CaptionTemplateId,
  isCaptionTemplateId,
} from "@src/lib/captions/templates";
import { DEFAULT_CAPTION_STYLE } from "@src/lib/captions/style";
import { normalizeCaptionStyle } from "@src/lib/captions/parse-style";
import { useEditor } from "../../store";

import { CaptionStyleFields } from "./CaptionStyleFields";
import { StyleTemplatePicker } from "./StyleTemplatePicker";

function matchingCaptionTemplateId(
  style: ReturnType<typeof normalizeCaptionStyle>,
): CaptionTemplateId | null {
  const key = JSON.stringify(style);
  for (const template of CAPTION_TEMPLATE_LIST) {
    if (JSON.stringify(template.style) === key) return template.id;
  }
  return null;
}

export function CaptionsInspector() {
  const rawStyle = useEditor((s) => s.config?.captionStyle ?? DEFAULT_CAPTION_STYLE);
  const updateCaptionStyle = useEditor((s) => s.updateCaptionStyle);
  const setCaptionStyle = useEditor((s) => s.setCaptionStyle);
  const style = normalizeCaptionStyle(rawStyle, DEFAULT_CAPTION_STYLE);
  const selectedId = matchingCaptionTemplateId(style);

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden">
      <StyleTemplatePicker
        templates={CAPTION_TEMPLATE_LIST}
        value={selectedId}
        fallbackStyle={style}
        onChange={(id) => {
          if (!isCaptionTemplateId(id)) return;
          setCaptionStyle(resolveCaptionTemplateStyle(id));
        }}
      />
      <CaptionStyleFields
        style={style}
        onPatch={(partial, live) => updateCaptionStyle(partial, live)}
      />
    </div>
  );
}
