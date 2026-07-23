import {
  TITLE_TEMPLATE_LIST,
  isTitleTemplateId,
  resolveTitleTemplateStyle,
  DEFAULT_TITLE_STYLE,
  type TitleTemplateId,
} from "@src/lib/title/templates";
import { normalizeCaptionStyle } from "@src/lib/captions/parse-style";
import { useEditor } from "../../store";

import { StyleTemplatePicker } from "./StyleTemplatePicker";

function matchingTitleTemplateId(
  style: ReturnType<typeof normalizeCaptionStyle>,
): TitleTemplateId | null {
  const key = JSON.stringify(style);
  for (const template of TITLE_TEMPLATE_LIST) {
    if (
      JSON.stringify(normalizeCaptionStyle(template.style, DEFAULT_TITLE_STYLE)) ===
      key
    ) {
      return template.id;
    }
  }
  return null;
}

export function TitleInspector() {
  const rawStyle = useEditor((s) => s.config?.titleStyle ?? DEFAULT_TITLE_STYLE);
  const setTitleStyle = useEditor((s) => s.setTitleStyle);
  const style = normalizeCaptionStyle(rawStyle, DEFAULT_TITLE_STYLE);
  const selectedId = matchingTitleTemplateId(style);

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden">
      <StyleTemplatePicker
        templates={TITLE_TEMPLATE_LIST}
        value={selectedId}
        fallbackStyle={style}
        onChange={(id) => {
          if (!isTitleTemplateId(id)) return;
          setTitleStyle(resolveTitleTemplateStyle(id));
        }}
      />
    </div>
  );
}
