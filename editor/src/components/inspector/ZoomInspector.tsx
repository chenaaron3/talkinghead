import type { SourcePunchIn } from "@src/lib/types";

import {
    DEFAULT_PUNCH_IN_ANIMATE, DEFAULT_PUNCH_IN_WORD_BY_WORD, PUNCH_IN_STRENGTH,
    punchInStrengthFromScale
} from '../../lib/punchin';
import { useEditor } from '../../store';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { ToggleField } from './field';

import type { PunchInStrength } from '../../lib/punchin';
const STRENGTH_OPTIONS: Array<{ id: PunchInStrength; label: string }> = [
  { id: "light", label: "Light" },
  { id: "medium", label: "Medium" },
  { id: "strong", label: "Strong" },
];

export function ZoomInspector({
  index,
  punchIn,
}: {
  index: number;
  punchIn: SourcePunchIn;
}) {
  const updatePunchIn = useEditor((s) => s.updatePunchIn);
  const strength = punchInStrengthFromScale(punchIn.scale);
  const wordByWord = punchIn.wordByWord ?? DEFAULT_PUNCH_IN_WORD_BY_WORD;
  const animate = punchIn.animate ?? DEFAULT_PUNCH_IN_ANIMATE;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Strength</Label>
        <div className="grid grid-cols-3 gap-1">
          {STRENGTH_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={strength === option.id ? "default" : "outline"}
              className="px-1"
              onClick={() => {
                useEditor.getState().beginGesture();
                updatePunchIn(
                  index,
                  { scale: PUNCH_IN_STRENGTH[option.id] },
                  true,
                );
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <ToggleField
        label="Word by word"
        checked={wordByWord}
        onCheckedChange={(checked) =>
          updatePunchIn(index, { wordByWord: checked }, true)
        }
      />

      {!wordByWord && (
        <ToggleField
          label="Ease"
          checked={animate}
          onCheckedChange={(checked) =>
            updatePunchIn(index, { animate: checked }, true)
          }
        />
      )}
    </div>
  );
}
