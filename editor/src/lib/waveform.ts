export type WaveformData = {
  peaks: Float32Array;
  peaksPerSec: number;
};

const DEFAULT_PEAKS_PER_SEC = 200;

/** Decode the episode video and build peak amplitudes from the audio track. */
export async function loadWaveformFromVideo(
  videoUrl: string,
  peaksPerSec = DEFAULT_PEAKS_PER_SEC,
): Promise<WaveformData> {
  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch audio source (${res.status})`);
  }

  const buffer = await res.arrayBuffer();
  const ctx = new AudioContext();

  try {
    const audioBuffer = await ctx.decodeAudioData(buffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const samplesPerPeak = Math.max(1, Math.floor(sampleRate / peaksPerSec));
    const peakCount = Math.ceil(channel.length / samplesPerPeak);
    const peaks = new Float32Array(peakCount);

    for (let i = 0; i < peakCount; i++) {
      const from = i * samplesPerPeak;
      const to = Math.min(from + samplesPerPeak, channel.length);
      let max = 0;
      for (let j = from; j < to; j++) {
        const sample = Math.abs(channel[j]!);
        if (sample > max) max = sample;
      }
      peaks[i] = max;
    }

    return { peaks, peaksPerSec };
  } finally {
    await ctx.close();
  }
}

/** Sample normalized peak amplitudes for a source-time range. */
export function sampleWaveformRange(
  waveform: WaveformData,
  startSec: number,
  endSec: number,
  barCount: number,
  globalMax?: number,
): number[] {
  const { peaks, peaksPerSec } = waveform;
  if (barCount < 2 || endSec <= startSec) return [];

  const maxAmp = globalMax ?? peakMax(peaks);
  const out: number[] = [];

  for (let i = 0; i < barCount; i++) {
    const t = startSec + (i / (barCount - 1)) * (endSec - startSec);
    const idx = Math.min(
      peaks.length - 1,
      Math.max(0, Math.floor(t * peaksPerSec)),
    );
    out.push(maxAmp > 0 ? peaks[idx]! / maxAmp : 0);
  }

  return out;
}

export function peakMax(peaks: Float32Array): number {
  let max = 0;
  for (let i = 0; i < peaks.length; i++) {
    if (peaks[i]! > max) max = peaks[i]!;
  }
  return max;
}
