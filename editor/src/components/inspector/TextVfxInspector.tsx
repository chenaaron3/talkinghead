import {
  TEXT_TEMPLATE_LIST,
  type TextTemplateId,
} from "@src/lib/text/templates";
import type { SourceTextVfx } from "@src/lib/types";
import {
  resolveTextStyle,
  resolveTextTemplateId,
} from "../../lib/vfx";
import { useEditor } from "../../store";

import { CaptionStyleFields } from "./CaptionStyleFields";
import { TextField } from "./field";
import { StyleTemplatePicker } from "./StyleTemplatePicker";

export function TextVfxInspector({ clip }: { clip: SourceTextVfx }) {
  const updateTextTemplate = useEditor((s) => s.updateTextTemplate);
  const updateTextVfxStyle = useEditor((s) => s.updateTextVfxStyle);
  const updateTextVfxContent = useEditor((s) => s.updateTextVfxContent);
  const templateId = resolveTextTemplateId(clip);
  const style = resolveTextStyle(clip);

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden">
      <TextField
        id="text-vfx-content"
        label="Text"
        value={clip.text}
        onLiveChange={(text) => updateTextVfxContent(clip.id, text, true)}
      />
      <StyleTemplatePicker
        templates={TEXT_TEMPLATE_LIST}
        value={templateId}
        onChange={(id) => updateTextTemplate(clip.id, id as TextTemplateId)}
      />
      <CaptionStyleFields
        style={style}
        onPatch={(partial, live) => updateTextVfxStyle(clip.id, partial, live)}
      />
    </div>
  );
}
