import {
  CAPTION_TEMPLATE_LIST,
  DEFAULT_CAPTION_TEMPLATE_ID,
  isCaptionTemplateId,
  resolveCaptionTemplateStyle,
  type CaptionTemplateId,
} from "@src/lib/captions/templates";
import {
  applyCaptionOverrides,
  type CaptionStyleOverrides,
} from "@src/lib/captions/style";
import { normalizeCaptionOverrides } from "@src/lib/captions/parse-style";
import { useEditor } from "../../store";

import { CaptionStyleFields } from "./CaptionStyleFields";
import { StyleTemplatePicker } from "./StyleTemplatePicker";

export function CaptionsInspector() {
  const config = useEditor((s) => s.config);
  const updateCaptionOverrides = useEditor((s) => s.updateCaptionOverrides);
  const setCaptionTemplate = useEditor((s) => s.setCaptionTemplate);

  const templateId = isCaptionTemplateId(config?.captionTemplateId)
    ? config.captionTemplateId
    : DEFAULT_CAPTION_TEMPLATE_ID;
  const overrides = normalizeCaptionOverrides(config?.captionStyle);
  const style = applyCaptionOverrides(
    resolveCaptionTemplateStyle(templateId),
    overrides,
  );

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden">
      <StyleTemplatePicker
        templates={CAPTION_TEMPLATE_LIST}
        value={templateId}
        fallbackStyle={style}
        onChange={(id) => {
          if (!isCaptionTemplateId(id)) return;
          setCaptionTemplate(id as CaptionTemplateId);
        }}
      />
      <CaptionStyleFields
        overrides={overrides}
        resolvedFill={style.wordStyle.fill}
        resolvedY={style.y}
        resolvedFontSize={style.fontSize}
        resolvedCaptionsAtATime={style.captionsAtATime}
        onPatch={(partial: CaptionStyleOverrides, live) =>
          updateCaptionOverrides(partial, live)
        }
      />
    </div>
  );
}
