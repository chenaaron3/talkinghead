export const DEFAULT_PEAKS_PER_SEC = 200;

export type WaveformData = {
  peaks: Float32Array;
  peaksPerSec: number;
};

export type WaveformSource = {
  path: string;
  size: number;
  mtimeMs: number;
};

/** Cached in source/<episode>/generated/waveform.json */
export type SerializedWaveform = {
  peaksPerSec: number;
  peaks: number[];
  duration: number;
  source: WaveformSource;
};

export function serializeWaveform(
  data: WaveformData,
  meta: { duration: number; source: WaveformSource },
): SerializedWaveform {
  return {
    peaksPerSec: data.peaksPerSec,
    peaks: Array.from(data.peaks),
    duration: meta.duration,
    source: meta.source,
  };
}

export function deserializeWaveform(raw: SerializedWaveform): WaveformData {
  return {
    peaksPerSec: raw.peaksPerSec,
    peaks: new Float32Array(raw.peaks),
  };
}

/** Build peak amplitudes from mono PCM samples (normalized 0–1). */
export function computePeaksFromSamples(
  samples: Int16Array | Float32Array,
  sampleRate: number,
  peaksPerSec = DEFAULT_PEAKS_PER_SEC,
): Float32Array {
  const samplesPerPeak = Math.max(1, Math.floor(sampleRate / peaksPerSec));
  const peakCount = Math.ceil(samples.length / samplesPerPeak);
  const peaks = new Float32Array(peakCount);
  const isInt16 = samples instanceof Int16Array;

  for (let i = 0; i < peakCount; i++) {
    const from = i * samplesPerPeak;
    const to = Math.min(from + samplesPerPeak, samples.length);
    let max = 0;
    for (let j = from; j < to; j++) {
      const sample = isInt16
        ? Math.abs(samples[j]!) / 32768
        : Math.abs(samples[j]!);
      if (sample > max) max = sample;
    }
    peaks[i] = max;
  }

  return peaks;
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

type ParsedWav = {
  samples: Int16Array;
  sampleRate: number;
};

/** Parse a mono/stereo 16-bit PCM WAV produced by ffmpeg. */
export function parseWavPcmS16le(buf: Buffer): ParsedWav {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("Invalid WAV file");
  }

  let offset = 12;
  let sampleRate = 16_000;
  let numChannels = 1;
  let bitsPerSample = 16;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === "fmt ") {
      numChannels = buf.readUInt16LE(chunkStart + 2);
      sampleRate = buf.readUInt32LE(chunkStart + 4);
      bitsPerSample = buf.readUInt16LE(chunkStart + 14);
    } else if (chunkId === "data") {
      dataOffset = chunkStart;
      dataSize = chunkSize;
      break;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (dataOffset === 0 || bitsPerSample !== 16) {
    throw new Error("Unsupported WAV format (expected 16-bit PCM)");
  }

  const frameSize = (bitsPerSample / 8) * numChannels;
  const frameCount = Math.floor(dataSize / frameSize);
  const samples = new Int16Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    samples[i] = buf.readInt16LE(dataOffset + i * frameSize);
  }

  return { samples, sampleRate };
}

export function peaksFromWavBuffer(
  buf: Buffer,
  peaksPerSec = DEFAULT_PEAKS_PER_SEC,
): WaveformData {
  const { samples, sampleRate } = parseWavPcmS16le(buf);
  return {
    peaks: computePeaksFromSamples(samples, sampleRate, peaksPerSec),
    peaksPerSec,
  };
}
