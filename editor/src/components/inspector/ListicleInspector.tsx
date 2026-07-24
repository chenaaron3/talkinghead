import type { ListicleTemplateId } from "@src/lib/listicle/templates";

import { LISTICLE_TEMPLATE_LIST, resolveListicleOverlayTemplateId } from '../../lib/listicle';
import { useEditor } from '../../store';
import { StyleTemplatePicker } from './StyleTemplatePicker';

export function ListicleInspector() {
  const listicle = useEditor((s) => s.config?.listicleOverlay);
  const updateListicleTemplate = useEditor((s) => s.updateListicleTemplate);

  if (!listicle) return null;

  const templateId = resolveListicleOverlayTemplateId(listicle);

  return (
    <div className="flex flex-col gap-4">
      <StyleTemplatePicker
        templates={LISTICLE_TEMPLATE_LIST.map((t) => ({
          id: t.id,
          label: t.label,
          style: t.marker.style,
        }))}
        value={templateId}
        onChange={(id) =>
          updateListicleTemplate(id as ListicleTemplateId)
        }
      />
    </div>
  );
}
