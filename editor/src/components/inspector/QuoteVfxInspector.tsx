import type { SourceQuoteVfx } from "@src/lib/types";
import { QUOTE_TEMPLATE_LIST, type QuoteTemplateId } from "@src/lib/captions/quote-templates";
import { normalizeCaptionOverrides } from "@src/lib/captions/parse-style";
import {
  resolveQuoteStyle,
  resolveQuoteTemplateId,
} from "../../lib/vfx";
import { useEditor } from "../../store";

import { CaptionStyleFields } from "./CaptionStyleFields";
import { StyleTemplatePicker } from "./StyleTemplatePicker";

export function QuoteVfxInspector({ clip }: { clip: SourceQuoteVfx }) {
  const updateQuoteTemplate = useEditor((s) => s.updateQuoteTemplate);
  const updateQuoteStyle = useEditor((s) => s.updateQuoteStyle);
  const templateId = resolveQuoteTemplateId(clip);
  const style = resolveQuoteStyle(clip);
  const overrides = normalizeCaptionOverrides(clip.style);

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden">
      <StyleTemplatePicker
        templates={QUOTE_TEMPLATE_LIST}
        value={templateId}
        onChange={(id) => updateQuoteTemplate(clip.id, id as QuoteTemplateId)}
      />
      <CaptionStyleFields
        overrides={overrides}
        resolvedFill={style.wordStyle.fill}
        resolvedY={style.y}
        resolvedFontSize={style.fontSize}
        resolvedCaptionsAtATime={style.captionsAtATime}
        onPatch={(partial, live) => updateQuoteStyle(clip.id, partial, live)}
      />
    </div>
  );
}
