import { TEXT_TEMPLATE_LIST } from '@src/lib/text/templates';
import { normalizeCaptionOverrides } from '@src/lib/captions/parse-style';

import { resolveTextStyle, resolveTextTemplateId } from '../../lib/vfx';
import { useEditor } from '../../store';
import { CaptionStyleFields } from './CaptionStyleFields';
import { EntranceSfxField } from './EntranceSfxField';
import { TextField } from './field';
import { StyleTemplatePicker } from './StyleTemplatePicker';

import type { TextTemplateId } from "@src/lib/text/templates";
import type { SourceScreenTextVfx } from "@src/lib/types";

export function TextVfxInspector({ clip }: { clip: SourceScreenTextVfx }) {
  const updateTextTemplate = useEditor((s) => s.updateTextTemplate);
  const updateTextVfxStyle = useEditor((s) => s.updateTextVfxStyle);
  const updateTextVfxContent = useEditor((s) => s.updateTextVfxContent);
  const updateTextVfxSfx = useEditor((s) => s.updateTextVfxSfx);
  const updateTextVfxSfxVolume = useEditor((s) => s.updateTextVfxSfxVolume);
  const templateId = resolveTextTemplateId(clip);
  const style = resolveTextStyle(clip);
  const overrides = normalizeCaptionOverrides(clip.style);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <TextField
        id="text-vfx-content"
        label="Text"
        value={clip.text}
        onLiveChange={(text) => updateTextVfxContent(clip.id, text, true)}
      />
      <StyleTemplatePicker
        templates={TEXT_TEMPLATE_LIST}
        value={templateId}
        fallbackStyle={style}
        onChange={(id) => updateTextTemplate(clip.id, id as TextTemplateId)}
        previewVariant="static"
      />
      <EntranceSfxField
        value={clip.sfx}
        onChange={(sfx) => updateTextVfxSfx(clip.id, sfx, true)}
        onVolumeChange={(v) => updateTextVfxSfxVolume(clip.id, v, true)}
      />
      <CaptionStyleFields
        overrides={overrides}
        resolvedFill={style.wordStyle.fill}
        resolvedY={style.y}
        resolvedFontSize={style.fontSize}
        onPatch={(partial, live) => updateTextVfxStyle(clip.id, partial, live)}
        showCaptionsAtATime={false}
      />
    </div>
  );
}
