import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { BULK_DIR, SOURCE_DIR, VIDEO_EXTENSIONS } from "./helpers/types";
import { runProcess } from "./process";
import { runSchedule } from "./schedule/run";

/** Local wall-clock stamp: YYYYMMDD-HHMMSS */
function formatEpisodeTimestamp(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
}

function listBulkVideos(): string[] {
  if (!fs.existsSync(BULK_DIR)) {
    return [];
  }
  return fs
    .readdirSync(BULK_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => VIDEO_EXTENSIONS.has(path.extname(name)))
    .sort((a, b) => a.localeCompare(b));
}

function claimBulkVideo(filename: string): {
  episodeId: string;
  episodeDir: string;
} {
  const basename = path
    .basename(filename, path.extname(filename))
    .replace(/[^a-zA-Z0-9-]/g, "-");
  const episodeId = `${formatEpisodeTimestamp(new Date())}-${basename}`;
  const episodeDir = path.join(SOURCE_DIR, episodeId);

  fs.mkdirSync(episodeDir, { recursive: true });
  const from = path.join(BULK_DIR, filename);
  const to = path.join(episodeDir, filename);
  fs.renameSync(from, to);
  console.log(`[bulk] moved ${filename} → source/${episodeId}/`);
  return { episodeId, episodeDir };
}

function parseArgs(argv: string[]) {
  const skipSchedule = argv.includes("--skip-schedule");
  return { skipSchedule };
}

async function main() {
  const { skipSchedule } = parseArgs(process.argv.slice(2));
  const videos = listBulkVideos();
  if (videos.length === 0) {
    console.log(`[bulk] no videos in ${path.relative(process.cwd(), BULK_DIR)}`);
    return;
  }

  console.log(`[bulk] ${videos.length} video(s): ${videos.join(", ")}`);
  if (skipSchedule) {
    console.log("[bulk] scheduling skipped (--skip-schedule)");
  }

  const failures: Array<{ file: string; episodeId?: string; error: string }> =
    [];
  let ok = 0;

  for (const filename of videos) {
    let episodeId: string | undefined;
    try {
      console.log(`\n[bulk] ── ${filename} ──`);
      ({ episodeId } = claimBulkVideo(filename));

      await runProcess([path.join("source", episodeId)]);
      if (!skipSchedule) {
        await runSchedule([path.join("source", episodeId)]);
      }

      ok += 1;
      console.log(`[bulk] ok ${episodeId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[bulk] failed ${filename}: ${message}`);
      failures.push({ file: filename, episodeId, error: message });
    }
  }

  console.log(
    `\n[bulk] done — ${ok} succeeded, ${failures.length} failed (of ${videos.length})`,
  );
  if (failures.length > 0) {
    for (const f of failures) {
      const where = f.episodeId ? ` → source/${f.episodeId}` : "";
      console.error(`  - ${f.file}${where}: ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
