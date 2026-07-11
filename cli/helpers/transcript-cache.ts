import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";

type TranscriptCacheEnvelope<T> = {
  transcriptPath: string;
  transcriptSize: number;
  transcriptMtimeMs: number;
  detection: T;
};

function isFresh(
  cached: TranscriptCacheEnvelope<unknown>,
  transcriptPath: string,
): boolean {
  if (!fs.existsSync(transcriptPath)) return false;
  const stat = fs.statSync(transcriptPath);
  return (
    cached.transcriptPath === transcriptPath &&
    cached.transcriptSize === stat.size &&
    Math.abs(cached.transcriptMtimeMs - stat.mtimeMs) < 1
  );
}

function readCache<T>(
  cachePath: string,
  transcriptPath: string,
  schema: z.ZodType<T>,
): T | null {
  if (!fs.existsSync(cachePath) || !fs.existsSync(transcriptPath)) return null;
  try {
    const cached = JSON.parse(
      fs.readFileSync(cachePath, "utf8"),
    ) as TranscriptCacheEnvelope<unknown>;
    if (!isFresh(cached, transcriptPath)) return null;
    return schema.parse(cached.detection);
  } catch {
    return null;
  }
}

function writeCache<T>(
  cachePath: string,
  transcriptPath: string,
  detection: T,
) {
  const stat = fs.statSync(transcriptPath);
  const payload: TranscriptCacheEnvelope<T> = {
    transcriptPath,
    transcriptSize: stat.size,
    transcriptMtimeMs: stat.mtimeMs,
    detection,
  };
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

/** Return cached detection if fresh, otherwise compute, write cache, and return. */
export async function getResultsOrCached<T>(options: {
  cachePath: string;
  transcriptPath: string;
  force: boolean;
  schema: z.ZodType<T>;
  compute: () => Promise<T>;
}): Promise<T> {
  const { cachePath, transcriptPath, force, schema, compute } = options;

  if (!force) {
    const cached = readCache(cachePath, transcriptPath, schema);
    if (cached) {
      console.log(`[cache] reusing ${cachePath}`);
      return cached;
    }
  }

  const detection = await compute();
  writeCache(cachePath, transcriptPath, detection);
  return detection;
}
