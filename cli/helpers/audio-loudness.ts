import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  AUDIO_LOUDNESS_TARGET_LUFS,
  gainFromLoudness,
  type AudioLoudnessData,
  type AudioLoudnessEntry,
} from "../../src/lib/audio/loudness";
import {
  AUDIO_EXTENSIONS,
  PUBLIC_MUSIC_DIR,
  PUBLIC_SFX_DIR,
  ROOT,
} from "./types";

/** Re-measure with looping when shorter than this (ebur128 needs ~400ms). */
const SHORT_SEC = 0.5;
/** Looped measurement window for short one-shots. */
const LOOP_MEASURE_SEC = 4;

const AGGREGATE_PATH = path.join(ROOT, "src", "data", "audio-loudness.json");

type LoudnormProbe = {
  lufs: number;
  truePeakDb: number;
};

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function isAudioFile(name: string): boolean {
  const ext = path.extname(name);
  return AUDIO_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext.toLowerCase());
}

function probeDurationSec(absPath: string): number {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      absPath,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(
      `ffprobe failed for ${absPath}\n${result.stderr || result.stdout}`,
    );
  }
  const n = Number.parseFloat((result.stdout || "").trim());
  return Number.isFinite(n) ? n : 0;
}

function parseLoudnorm(stderr: string): LoudnormProbe | null {
  const match = stderr.match(
    /\{\s*"input_i"\s*:\s*"([^"]+)"[\s\S]*?"input_tp"\s*:\s*"([^"]+)"/,
  );
  if (!match) return null;
  const lufs = Number.parseFloat(match[1]!);
  const truePeakDb = Number.parseFloat(match[2]!);
  if (!Number.isFinite(truePeakDb)) return null;
  return { lufs, truePeakDb };
}

function runLoudnorm(absPath: string, loop: boolean): LoudnormProbe {
  const args = [
    "-hide_banner",
    "-nostats",
    ...(loop ? ["-stream_loop", "80"] : []),
    "-i",
    absPath,
    ...(loop ? ["-t", String(LOOP_MEASURE_SEC)] : []),
    "-af",
    "loudnorm=print_format=json",
    "-f",
    "null",
    "-",
  ];
  const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
  // loudnorm JSON is on stderr; ffmpeg still exits 0
  const parsed = parseLoudnorm(result.stderr || "");
  if (!parsed) {
    throw new Error(
      `ffmpeg loudnorm failed for ${absPath}\n${result.stderr || result.stdout}`,
    );
  }
  return parsed;
}

function measureFile(absPath: string): AudioLoudnessEntry {
  const durationSec = probeDurationSec(absPath);
  let probe = runLoudnorm(absPath, false);
  const needLoop =
    durationSec < SHORT_SEC || !Number.isFinite(probe.lufs);
  if (needLoop) {
    probe = runLoudnorm(absPath, true);
  }
  if (!Number.isFinite(probe.lufs)) {
    throw new Error(`Could not measure LUFS for ${absPath}`);
  }
  return {
    lufs: round(probe.lufs, 2),
    truePeakDb: round(probe.truePeakDb, 2),
    gain: round(
      gainFromLoudness(probe.lufs, probe.truePeakDb, AUDIO_LOUDNESS_TARGET_LUFS),
      4,
    ),
  };
}

function round(n: number, digits: number): number {
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

/** Walk public/sfx (flat + one folder level) → public-relative src paths. */
export function listSharedSfxFiles(): Array<{ abs: string; src: string }> {
  if (!fs.existsSync(PUBLIC_SFX_DIR)) return [];
  const out: Array<{ abs: string; src: string }> = [];

  const push = (abs: string, relParts: string[]) => {
    if (!isAudioFile(abs)) return;
    const rel = relParts.join("/");
    out.push({
      abs,
      src: path.join("sfx", rel).split(path.sep).join("/"),
    });
  };

  for (const entry of fs.readdirSync(PUBLIC_SFX_DIR, { withFileTypes: true })) {
    if (entry.name === "loudness.json") continue;
    if (entry.isFile()) {
      push(path.join(PUBLIC_SFX_DIR, entry.name), [entry.name]);
      continue;
    }
    if (!entry.isDirectory()) continue;
    const folderDir = path.join(PUBLIC_SFX_DIR, entry.name);
    for (const child of fs.readdirSync(folderDir, { withFileTypes: true })) {
      if (!child.isFile()) continue;
      push(path.join(folderDir, child.name), [entry.name, child.name]);
    }
  }
  return out.sort((a, b) => a.src.localeCompare(b.src));
}

/** Walk public/music (flat shared library only). */
export function listSharedMusicFiles(): Array<{ abs: string; src: string }> {
  if (!fs.existsSync(PUBLIC_MUSIC_DIR)) return [];
  const out: Array<{ abs: string; src: string }> = [];
  for (const entry of fs.readdirSync(PUBLIC_MUSIC_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name === "loudness.json") continue;
    if (!isAudioFile(entry.name)) continue;
    out.push({
      abs: path.join(PUBLIC_MUSIC_DIR, entry.name),
      src: path.join("music", entry.name).split(path.sep).join("/"),
    });
  }
  return out.sort((a, b) => a.src.localeCompare(b.src));
}

function isValidEntry(value: unknown): value is AudioLoudnessEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as AudioLoudnessEntry;
  return (
    Number.isFinite(entry.lufs) &&
    Number.isFinite(entry.truePeakDb) &&
    Number.isFinite(entry.gain) &&
    entry.gain > 0
  );
}

function readExistingLoudness(
  filePath: string,
): Record<string, AudioLoudnessEntry> {
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      files?: Record<string, unknown>;
    };
    const filesOut: Record<string, AudioLoudnessEntry> = {};
    for (const [src, value] of Object.entries(raw.files ?? {})) {
      if (isValidEntry(value)) filesOut[src] = value;
    }
    return filesOut;
  } catch {
    return {};
  }
}

/** Refresh gain from cached LUFS/peak when target LUFS changes. */
function withCurrentGain(entry: AudioLoudnessEntry): AudioLoudnessEntry {
  return {
    ...entry,
    gain: round(
      gainFromLoudness(entry.lufs, entry.truePeakDb, AUDIO_LOUDNESS_TARGET_LUFS),
      4,
    ),
  };
}

function measureLibrary(
  files: Array<{ abs: string; src: string }>,
  existing: Record<string, AudioLoudnessEntry>,
  force: boolean,
): { files: Record<string, AudioLoudnessEntry>; measured: number; skipped: number } {
  const filesOut: Record<string, AudioLoudnessEntry> = {};
  let measured = 0;
  let skipped = 0;

  for (const { abs, src } of files) {
    const prev = existing[src];
    if (!force && prev) {
      filesOut[src] = withCurrentGain(prev);
      skipped += 1;
      console.log(`[loudness] ${src} … skip (cached)`);
      continue;
    }

    process.stdout.write(`[loudness] ${src} … `);
    const entry = measureFile(abs);
    filesOut[src] = entry;
    measured += 1;
    console.log(
      `lufs=${entry.lufs.toFixed(2)} peak=${entry.truePeakDb.toFixed(2)} gain=${entry.gain}`,
    );
  }

  return { files: filesOut, measured, skipped };
}

export type RebuildAudioLoudnessOptions = {
  /** Remeasure every file even when a cache entry exists. */
  force?: boolean;
};

/**
 * Measure shared SFX + music libraries, write sidecars + aggregate JSON
 * consumed by Remotion/editor via `loudnessGainFor()`.
 *
 * By default only new/missing files are measured; pass `{ force: true }`
 * (or `--force`) to remeasure everything.
 */
export function rebuildAudioLoudness(
  options: RebuildAudioLoudnessOptions = {},
): AudioLoudnessData {
  const force = options.force === true;
  const sfxPath = path.join(PUBLIC_SFX_DIR, "loudness.json");
  const musicPath = path.join(PUBLIC_MUSIC_DIR, "loudness.json");

  const sfxResult = measureLibrary(
    listSharedSfxFiles(),
    force ? {} : readExistingLoudness(sfxPath),
    force,
  );
  const musicResult = measureLibrary(
    listSharedMusicFiles(),
    force ? {} : readExistingLoudness(musicPath),
    force,
  );

  const sfxData: AudioLoudnessData = {
    targetLufs: AUDIO_LOUDNESS_TARGET_LUFS,
    files: sfxResult.files,
  };
  const musicData: AudioLoudnessData = {
    targetLufs: AUDIO_LOUDNESS_TARGET_LUFS,
    files: musicResult.files,
  };
  const aggregate: AudioLoudnessData = {
    targetLufs: AUDIO_LOUDNESS_TARGET_LUFS,
    files: { ...sfxResult.files, ...musicResult.files },
  };

  writeJson(sfxPath, sfxData);
  writeJson(musicPath, musicData);
  writeJson(AGGREGATE_PATH, aggregate);

  const measured = sfxResult.measured + musicResult.measured;
  const skipped = sfxResult.skipped + musicResult.skipped;
  console.log(
    `[loudness] wrote ${Object.keys(sfxResult.files).length} sfx + ${Object.keys(musicResult.files).length} music` +
      ` (measured ${measured}, skipped ${skipped}${force ? ", force" : ""}) →`,
  );
  console.log(`  public/sfx/loudness.json`);
  console.log(`  public/music/loudness.json`);
  console.log(`  src/data/audio-loudness.json`);

  return aggregate;
}
