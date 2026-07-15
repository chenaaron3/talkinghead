import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { buildProps } from "../../src/lib/build-props";
import {
  findSourceVideo,
  loadEpisodeConfig,
  writeEpisodeConfig,
} from "../../cli/helpers/config";
import { rebuildAllPropsIndex } from "../../cli/helpers/props-index";
import { probeVideoFps } from "../../cli/helpers/whisper";
import {
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  PUBLIC_SFX_DIR,
  ROOT,
  SOURCE_DIR,
} from "../../cli/helpers/types";
import { renderEpisode } from "../../cli/render-episode";
import type { EpisodeConfig, Transcript } from "../../cli/helpers/types";
import type { SerializedWaveform } from "../../src/lib/waveform";
import YAML from "yaml";
import { spawnSync } from "node:child_process";

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function linkIntoPublic(absPath: string, publicRel: string): string {
  const dest = path.join(ROOT, "public", publicRel);
  ensureDir(path.dirname(dest));
  try {
    fs.lstatSync(dest);
    fs.unlinkSync(dest);
  } catch {
    // missing
  }
  try {
    fs.linkSync(absPath, dest);
  } catch {
    fs.copyFileSync(absPath, dest);
  }
  return publicRel.split(path.sep).join("/");
}

function listEpisodeImages(episodeId: string) {
  const absDir = path.join(SOURCE_DIR, episodeId);
  if (!fs.existsSync(absDir)) return [];
  const out: Array<{
    key: string;
    label: string;
    sourcePath: string;
    publicSrc: string;
  }> = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!IMAGE_EXTENSIONS.has(ext)) continue;
    const abs = path.join(absDir, entry.name);
    const key = path.join(episodeId, entry.name).split(path.sep).join("/");
    const publicSrc = path.join("b-roll", key).split(path.sep).join("/");
    out.push({
      key,
      label: entry.name,
      sourcePath: abs,
      publicSrc,
    });
  }
  return out;
}

function probeAudioDurationSec(absPath: string): number {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      absPath,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return 0.5;
  try {
    const parsed = JSON.parse(result.stdout) as {
      format?: { duration?: string };
    };
    const duration = Number(parsed.format?.duration);
    return Number.isFinite(duration) && duration > 0 ? duration : 0.5;
  } catch {
    return 0.5;
  }
}

function listSfxAssets() {
  if (!fs.existsSync(PUBLIC_SFX_DIR)) return [];
  const out: Array<{
    key: string;
    label: string;
    src: string;
    durationSec: number;
  }> = [];
  for (const entry of fs.readdirSync(PUBLIC_SFX_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!AUDIO_EXTENSIONS.has(ext)) continue;
    const abs = path.join(PUBLIC_SFX_DIR, entry.name);
    const src = path.join("sfx", entry.name).split(path.sep).join("/");
    out.push({
      key: entry.name,
      label: entry.name.replace(/\.[^.]+$/, ""),
      src,
      durationSec: probeAudioDurationSec(abs),
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(
  res: import("http").ServerResponse,
  status: number,
  data: unknown,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function loadEpisodeData(episodeId: string) {
  const episodeDir = path.join(SOURCE_DIR, episodeId);
  const config = loadEpisodeConfig(episodeDir);
  const transcriptPath = path.join(episodeDir, "generated", "transcript.json");
  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`No transcript.json for episode ${episodeId}`);
  }
  const transcript = JSON.parse(
    fs.readFileSync(transcriptPath, "utf8"),
  ) as Transcript;

  const videoPath = findSourceVideo(episodeDir);
  const probe = probeVideoFps(videoPath);
  const ext = path.extname(videoPath).toLowerCase();
  const videoSrc = `episodes/${episodeId}/video${ext}`;
  const title = config.title ?? episodeId;

  const props = buildProps({
    episodeId,
    title,
    videoSrc,
    fps: probe.fps,
    config,
    transcript,
  });

  const waveformPath = path.join(episodeDir, "generated", "waveform.json");
  const waveform = fs.existsSync(waveformPath)
    ? (JSON.parse(fs.readFileSync(waveformPath, "utf8")) as SerializedWaveform)
    : null;

  return { episodeDir, config, transcript, props, probe, waveform };
}

function ensureBRollAssets(bRolls: EpisodeConfig["bRolls"]) {
  for (const clip of bRolls) {
    const absPublic = path.join(ROOT, "public", clip.src);
    if (fs.existsSync(absPublic)) continue;
    const key = clip.src.replace(/^b-roll\//, "");
    const absSource = path.join(SOURCE_DIR, key);
    if (fs.existsSync(absSource)) {
      linkIntoPublic(absSource, clip.src);
    }
  }
}

export function editorApiPlugin(episodeId: string): Plugin {
  return {
    name: "talking-head-editor-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const { pathname } = url;

        try {
          if (req.method === "GET" && pathname === "/api/episode") {
            const { config, transcript, props, waveform } =
              loadEpisodeData(episodeId);
            return sendJson(res, 200, {
              episodeId,
              config,
              transcript,
              props,
              waveform,
            });
          }

          if (req.method === "GET" && pathname === "/api/assets") {
            const assets = listEpisodeImages(episodeId).map((a) => {
              linkIntoPublic(a.sourcePath, a.publicSrc);
              return {
                key: a.key,
                label: a.label,
                src: a.publicSrc,
                thumbUrl: `/${a.publicSrc}`,
              };
            });
            const sfx = listSfxAssets();
            return sendJson(res, 200, { assets, sfx });
          }

          if (req.method === "PUT" && pathname === "/api/episode") {
            const raw = await readBody(req);
            const body = JSON.parse(raw) as {
              config: EpisodeConfig;
              transcript: Transcript;
            };
            if (!body.config || !body.transcript) {
              return sendJson(res, 400, { error: "Invalid episode payload" });
            }

            ensureBRollAssets(body.config.bRolls);

            const episodeDir = path.join(SOURCE_DIR, episodeId);
            const configPath = path.join(episodeDir, "config.yaml");
            const existingYaml = fs.existsSync(configPath)
              ? (YAML.parse(fs.readFileSync(configPath, "utf8")) as Record<
                  string,
                  unknown
                >) ?? {}
              : {};

            writeEpisodeConfig(episodeDir, {
              ...existingYaml,
              title: body.config.title,
              cuts: body.config.cuts,
              listicleOverlay: body.config.listicleOverlay,
              punchInSegments: body.config.punchInSegments,
              bRolls: body.config.bRolls,
              sfx: body.config.sfx ?? [],
            });

            const transcriptPath = path.join(
              episodeDir,
              "generated",
              "transcript.json",
            );
            writeJson(transcriptPath, body.transcript);

            const { props } = loadEpisodeData(episodeId);
            writeJson(path.join(episodeDir, "generated", "props.json"), props);
            rebuildAllPropsIndex(props);

            return sendJson(res, 200, { ok: true, props });
          }

          if (req.method === "POST" && pathname === "/api/ensure-broll") {
            const raw = await readBody(req);
            const body = JSON.parse(raw) as { key: string };
            const absSource = path.join(SOURCE_DIR, body.key);
            if (!fs.existsSync(absSource)) {
              return sendJson(res, 404, { error: "Asset not found" });
            }
            const publicSrc = path
              .join("b-roll", body.key)
              .split(path.sep).join("/");
            linkIntoPublic(absSource, publicSrc);
            return sendJson(res, 200, { src: publicSrc });
          }

          if (req.method === "POST" && pathname === "/api/export") {
            const episodeDir = path.join(SOURCE_DIR, episodeId);
            const raw = await readBody(req);
            if (raw.trim()) {
              const body = JSON.parse(raw) as {
                config?: EpisodeConfig;
                transcript?: Transcript;
              };
              if (body.config && body.transcript) {
                ensureBRollAssets(body.config.bRolls);
                writeEpisodeConfig(episodeDir, {
                  cuts: body.config.cuts,
                  listicleOverlay: body.config.listicleOverlay,
                  punchInSegments: body.config.punchInSegments,
                  bRolls: body.config.bRolls,
                  sfx: body.config.sfx ?? [],
                });
                writeJson(
                  path.join(episodeDir, "generated", "transcript.json"),
                  body.transcript,
                );
                const { props } = loadEpisodeData(episodeId);
                writeJson(
                  path.join(episodeDir, "generated", "props.json"),
                  props,
                );
                rebuildAllPropsIndex(props);
              }
            }

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("X-Accel-Buffering", "no");
            if (typeof (res as { flushHeaders?: () => void }).flushHeaders === "function") {
              (res as { flushHeaders: () => void }).flushHeaders();
            }

            const writeEvent = (data: unknown) => {
              res.write(`${JSON.stringify(data)}\n`);
            };

            try {
              await renderEpisode({
                episodeId,
                episodeDir,
                onProgress: (p) => {
                  writeEvent({ type: "progress", ...p });
                },
              });
              writeEvent({
                type: "done",
                downloadUrl: "/api/export/download",
                filename: `${episodeId}.mp4`,
              });
              res.end();
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              writeEvent({ type: "error", error: message });
              res.end();
            }
            return;
          }

          if (req.method === "GET" && pathname === "/api/export/download") {
            const videoPath = path.join(ROOT, "out", episodeId, "video.mp4");
            if (!fs.existsSync(videoPath)) {
              return sendJson(res, 404, { error: "No exported video yet" });
            }
            const stat = fs.statSync(videoPath);
            res.statusCode = 200;
            res.setHeader("Content-Type", "video/mp4");
            res.setHeader(
              "Content-Disposition",
              `attachment; filename="${episodeId}.mp4"`,
            );
            res.setHeader("Content-Length", String(stat.size));
            fs.createReadStream(videoPath).pipe(res);
            return;
          }

          next();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          sendJson(res, 500, { error: message });
        }
      });
    },
  };
}

export function resolveEpisodeId(argv: string[]): string {
  const positional = argv.filter((a) => !a.startsWith("-"));
  if (positional.length === 0) {
    throw new Error(
      "Usage: pnpm editor -- <episodeId>\nExample: pnpm editor -- day4",
    );
  }
  const episodeId = positional[0]!;
  const transcriptPath = path.join(
    SOURCE_DIR,
    episodeId,
    "generated",
    "transcript.json",
  );
  if (!fs.existsSync(transcriptPath)) {
    throw new Error(
      `Episode not processed (missing transcript.json): ${episodeId}`,
    );
  }
  return episodeId;
}
