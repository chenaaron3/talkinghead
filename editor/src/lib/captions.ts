import type { Transcript, TranscriptCaption } from "@src/lib/types";

export type FlatCaption = TranscriptCaption & { index: number };

export function flattenCaptions(captions: TranscriptCaption[]): FlatCaption[] {
  return captions.map((cap, index) => ({ ...cap, index }));
}

export function captionIndexAt(
  sourceSec: number,
  captions: TranscriptCaption[],
): number | null {
  for (let i = 0; i < captions.length; i++) {
    const caption = captions[i]!;
    if (sourceSec >= caption.start && sourceSec < caption.end) return i;
  }
  return null;
}

export function updateCaption(
  transcript: Transcript,
  index: number,
  patch: Partial<TranscriptCaption> & { clearEmphasis?: boolean },
): Transcript {
  const captions = transcript.captions.map((cap, i) => {
    if (i !== index) return cap;
    const next: TranscriptCaption = { ...cap, ...patch };
    delete (next as { clearEmphasis?: boolean }).clearEmphasis;
    if (patch.clearEmphasis) {
      delete next.emphasis;
    }
    return next;
  });
  return { ...transcript, captions };
}
