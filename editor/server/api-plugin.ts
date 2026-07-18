import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

import { findSourceVideo, loadEpisodeConfig, writeEpisodeConfig } from '../../cli/helpers/config';
import { createEpisodeWithVideo } from '../../cli/helpers/episode-id';
import { rebuildAllPropsIndex } from '../../cli/helpers/props-index';
import {
    AUDIO_EXTENSIONS, HEIC_EXTENSIONS, IMAGE_EXTENSIONS, PUBLIC_SFX_DIR, ROOT, SOURCE_DIR,
    VIDEO_EXTENSIONS
} from '../../cli/helpers/types';
import { probeVideoFps } from '../../cli/helpers/whisper';
import { runProcess } from '../../cli/process';
import { renderEpisode } from '../../cli/render-episode';
import { runSchedule } from '../../cli/schedule/run';
import { buildProps } from '../../src/lib/build-props';
import { normalizeBRollMedia, probeMedia } from './broll-media';
import { getEpisodeScheduleInfo, listEditorEpisodes } from './episodes';

import type { Plugin } from "vite";
import type { EpisodeConfig, Transcript } from "../../cli/helpers/types";
import type { SerializedWaveform } from "../../src/lib/waveform";
function sendNdjson(
  res: import("http").ServerResponse,
  writeEvent: (data: unknown) => void,
) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  if (
    typeof (res as { flushHeaders?: () => void }).flushHeaders === "function"
  ) {
    (res as { flushHeaders: () => void }).flushHeaders();
  }
  return writeEvent;
}

async function withConsoleLogs(
  onLine: (line: string) => void,
  fn: () => Promise<void>,
): Promise<void> {
  const emit = (args: unknown[]) => {
    const line = args
      .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
      .join(" ");
    if (line.trim()) onLine(line);
  };
  const prevLog = console.log;
  const prevError = console.error;
  console.log = (...args: unknown[]) => {
    emit(args);
    prevLog(...args);
  };
  console.error = (...args: unknown[]) => {
    emit(args);
    prevError(...args);
  };
  try {
    await fn();
  } finally {
    console.log = prevLog;
    console.error = prevError;
  }
}

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

function isBRollExt(ext: string): boolean {
  return (
    IMAGE_EXTENSIONS.has(ext) ||
    IMAGE_EXTENSIONS.has(ext.toLowerCase()) ||
    VIDEO_EXTENSIONS.has(ext) ||
    VIDEO_EXTENSIONS.has(ext.toLowerCase())
  );
}

function isHeicExt(ext: string): boolean {
  return HEIC_EXTENSIONS.has(ext) || HEIC_EXTENSIONS.has(ext.toLowerCase());
}

function isBRollImportExt(ext: string): boolean {
  return isBRollExt(ext) || isHeicExt(ext);
}

function isVideoExt(ext: string): boolean {
  return VIDEO_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext.toLowerCase());
}

/** Convert HEIC/HEIF → JPEG for Remotion / browser preview. */
function convertHeicToJpeg(srcAbs: string, destAbs: string): void {
  const sips = spawnSync(
    "sips",
    ["-s", "format", "jpeg", srcAbs, "--out", destAbs],
    { encoding: "utf8" },
  );
  if (sips.status === 0 && fs.existsSync(destAbs)) return;

  const ffmpeg = spawnSync("ffmpeg", ["-y", "-i", srcAbs, destAbs], {
    encoding: "utf8",
  });
  if (ffmpeg.status === 0 && fs.existsSync(destAbs)) return;

  const detail = [sips.stderr, ffmpeg.stderr].filter(Boolean).join("\n").trim();
  throw new Error(
    detail
      ? `Failed to convert HEIC: ${detail}`
      : "Failed to convert HEIC (tried sips and ffmpeg)",
  );
}

function listEpisodeBRollAssets(episodeId: string) {
  const absDir = path.join(SOURCE_DIR, episodeId);
  if (!fs.existsSync(absDir)) return [];

  let arollAbs: string | null = null;
  try {
    const config = loadEpisodeConfig(absDir);
    arollAbs = path.resolve(findSourceVideo(absDir, config.aroll));
  } catch {
    // Episode may not have a resolvable A-roll yet.
  }

  const out: Array<{
    key: string;
    label: string;
    sourcePath: string;
    publicSrc: string;
    width: number;
    height: number;
    durationSec?: number;
  }> = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!isBRollExt(ext)) continue;
    const abs = path.resolve(path.join(absDir, entry.name));
    // Never list the episode A-roll as b-roll material.
    if (arollAbs && abs === arollAbs) continue;
    const key = path.join(episodeId, entry.name).split(path.sep).join("/");
    const publicSrc = path.join("b-roll", key).split(path.sep).join("/");
    const video = isVideoExt(ext);
    normalizeBRollMedia(abs, video);
    const probe = probeMedia(abs);
    if (probe.width == null || probe.height == null) {
      throw new Error(`No visual dimensions for ${abs}`);
    }
    out.push({
      key,
      label: entry.name,
      sourcePath: abs,
      publicSrc,
      width: probe.width,
      height: probe.height,
      ...(video ? { durationSec: probe.durationSec } : {}),
    });
  }
  return out;
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
      durationSec: probeMedia(abs).durationSec,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return readBodyBuffer(req).then((buf) => buf.toString("utf8"));
}

function readBodyBuffer(req: import("http").IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function filenameFromRequest(req: import("http").IncomingMessage): string {
  const raw = req.headers["x-filename"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.trim()) {
    throw new Error("Missing X-Filename header");
  }
  try {
    return decodeURIComponent(value.trim());
  } catch {
    return value.trim();
  }
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

  const videoPath = findSourceVideo(episodeDir, config.aroll);
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

function episodeIdFromRequest(
  req: import("http").IncomingMessage,
  url: URL,
  defaultEpisodeId: string | null,
): string | null {
  const header = req.headers["x-episode-id"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  const query = url.searchParams.get("episodeId");
  if (query?.trim()) {
    return query.trim();
  }
  return defaultEpisodeId;
}

function requireEpisodeId(
  req: import("http").IncomingMessage,
  url: URL,
  defaultEpisodeId: string | null,
): string {
  const episodeId = episodeIdFromRequest(req, url, defaultEpisodeId);
  if (!episodeId) {
    throw new Error("No episode selected");
  }
  return episodeId;
}

export function editorApiPlugin(defaultEpisodeId: string | null): Plugin {
  return {
    name: "talking-head-editor-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const { pathname } = url;

        try {
          if (req.method === "GET" && pathname === "/api/bootstrap") {
            return sendJson(res, 200, { defaultEpisodeId });
          }

          if (req.method === "GET" && pathname === "/api/episodes") {
            return sendJson(res, 200, { episodes: listEditorEpisodes() });
          }

          if (req.method === "GET" && pathname === "/api/episode") {
            const episodeId = requireEpisodeId(req, url, defaultEpisodeId);
            const { config, transcript, props, waveform } =
              loadEpisodeData(episodeId);
            const schedule = getEpisodeScheduleInfo(episodeId);
            return sendJson(res, 200, {
              episodeId,
              config,
              transcript,
              props,
              waveform,
              schedule,
            });
          }

          if (req.method === "GET" && pathname === "/api/assets") {
            const episodeId = requireEpisodeId(req, url, defaultEpisodeId);
            const assets = listEpisodeBRollAssets(episodeId).map((a) => {
              linkIntoPublic(a.sourcePath, a.publicSrc);
              return {
                key: a.key,
                label: a.label,
                src: a.publicSrc,
                thumbUrl: `/${a.publicSrc}`,
                width: a.width,
                height: a.height,
                ...(a.durationSec != null
                  ? { durationSec: a.durationSec }
                  : {}),
              };
            });
            const sfx = listSfxAssets();
            return sendJson(res, 200, { assets, sfx });
          }

          if (req.method === "PUT" && pathname === "/api/episode") {
            const episodeId = requireEpisodeId(req, url, defaultEpisodeId);
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
              ? ((YAML.parse(fs.readFileSync(configPath, "utf8")) as Record<
                  string,
                  unknown
                >) ?? {})
              : {};

            writeEpisodeConfig(episodeDir, {
              ...existingYaml,
              aroll: body.config.aroll,
              title: body.config.title,
              captionsAtATime: body.config.captionsAtATime,
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
            requireEpisodeId(req, url, defaultEpisodeId);
            const raw = await readBody(req);
            const body = JSON.parse(raw) as { key: string };
            const absSource = path.join(SOURCE_DIR, body.key);
            if (!fs.existsSync(absSource)) {
              return sendJson(res, 404, { error: "Asset not found" });
            }
            const publicSrc = path
              .join("b-roll", body.key)
              .split(path.sep)
              .join("/");
            linkIntoPublic(absSource, publicSrc);
            return sendJson(res, 200, { src: publicSrc });
          }

          if (req.method === "POST" && pathname === "/api/import-episode") {
            const filename = filenameFromRequest(req);
            const videoExt = path.extname(filename);
            if (
              !VIDEO_EXTENSIONS.has(videoExt) &&
              !VIDEO_EXTENSIONS.has(videoExt.toLowerCase())
            ) {
              return sendJson(res, 400, {
                error:
                  "Unsupported video type. Drop .mp4 / .mov / .webm files.",
              });
            }
            const data = await readBodyBuffer(req);
            if (data.length === 0) {
              return sendJson(res, 400, { error: "Empty file" });
            }
            const { episodeId } = createEpisodeWithVideo({ filename, data });
            try {
              await runProcess([path.join("source", episodeId)]);
              return sendJson(res, 200, { episodeId });
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              return sendJson(res, 500, { error: message, episodeId });
            }
          }

          if (req.method === "POST" && pathname === "/api/import-broll") {
            const episodeId = requireEpisodeId(req, url, defaultEpisodeId);
            const filename = filenameFromRequest(req);
            const mediaExt = path.extname(filename);
            if (!isBRollImportExt(mediaExt)) {
              return sendJson(res, 400, {
                error:
                  "Unsupported media type. Drop .jpg / .png / .webp / .gif / .heic / .mp4 / .mov / .webm files.",
              });
            }
            const data = await readBodyBuffer(req);
            if (data.length === 0) {
              return sendJson(res, 400, { error: "Empty file" });
            }
            const episodeDir = path.join(SOURCE_DIR, episodeId);
            if (!fs.existsSync(episodeDir)) {
              return sendJson(res, 404, { error: "Episode not found" });
            }

            const safeName = path.basename(filename).replace(/[/\\]/g, "");
            const destName = isHeicExt(mediaExt)
              ? `${path.basename(safeName, mediaExt)}.jpg`
              : safeName;
            const absPath = path.join(episodeDir, destName);
            if (fs.existsSync(absPath)) {
              return sendJson(res, 409, {
                error: `${destName} already exists in this episode`,
              });
            }

            if (isHeicExt(mediaExt)) {
              const tmpHeic = `${absPath}.heic-import`;
              fs.writeFileSync(tmpHeic, data);
              try {
                convertHeicToJpeg(tmpHeic, absPath);
              } catch (err) {
                const message =
                  err instanceof Error ? err.message : String(err);
                return sendJson(res, 500, { error: message });
              } finally {
                try {
                  fs.unlinkSync(tmpHeic);
                } catch {
                  // ignore
                }
              }
            } else {
              fs.writeFileSync(absPath, data);
            }

            const video =
              isVideoExt(mediaExt) || isVideoExt(path.extname(destName));
            normalizeBRollMedia(absPath, video);

            const key = path
              .join(episodeId, destName)
              .split(path.sep)
              .join("/");
            const publicSrc = path
              .join("b-roll", key)
              .split(path.sep)
              .join("/");
            linkIntoPublic(absPath, publicSrc);
            const probe = probeMedia(absPath);
            if (probe.width == null || probe.height == null) {
              return sendJson(res, 500, {
                error: `No visual dimensions for ${destName}`,
              });
            }
            return sendJson(res, 200, {
              key,
              label: destName,
              src: publicSrc,
              thumbUrl: `/${publicSrc}`,
              width: probe.width,
              height: probe.height,
              ...(video ? { durationSec: probe.durationSec } : {}),
            });
          }

          if (req.method === "DELETE" && pathname === "/api/broll-asset") {
            const episodeId = requireEpisodeId(req, url, defaultEpisodeId);
            const raw = await readBody(req);
            const body = JSON.parse(raw || "{}") as { key?: string };
            const key = String(body.key ?? "").trim();
            if (!key) {
              return sendJson(res, 400, { error: "Missing asset key" });
            }
            const prefix = `${episodeId}/`;
            if (!key.startsWith(prefix) || key.includes("..")) {
              return sendJson(res, 400, { error: "Invalid asset key" });
            }
            const absSource = path.resolve(path.join(SOURCE_DIR, key));
            const episodeDir = path.resolve(path.join(SOURCE_DIR, episodeId));
            if (
              absSource !== episodeDir &&
              !absSource.startsWith(episodeDir + path.sep)
            ) {
              return sendJson(res, 400, { error: "Invalid asset path" });
            }
            try {
              const config = loadEpisodeConfig(episodeDir);
              const arollAbs = path.resolve(
                findSourceVideo(episodeDir, config.aroll),
              );
              if (absSource === arollAbs) {
                return sendJson(res, 400, {
                  error: "Cannot delete the episode A-roll",
                });
              }
            } catch {
              // No resolvable A-roll — still allow deleting b-roll files.
            }
            if (!fs.existsSync(absSource)) {
              return sendJson(res, 404, { error: "Asset not found" });
            }
            fs.unlinkSync(absSource);
            const publicRel = path
              .join("b-roll", key)
              .split(path.sep)
              .join("/");
            const publicAbs = path.join(ROOT, "public", publicRel);
            try {
              fs.unlinkSync(publicAbs);
            } catch {
              // missing public link is fine
            }
            return sendJson(res, 200, {
              ok: true,
              src: publicRel,
            });
          }

          if (req.method === "POST" && pathname === "/api/export") {
            const episodeId = requireEpisodeId(req, url, defaultEpisodeId);
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
                  aroll: body.config.aroll,
                  captionsAtATime: body.config.captionsAtATime,
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
            res.setHeader(
              "Content-Type",
              "application/x-ndjson; charset=utf-8",
            );
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("X-Accel-Buffering", "no");
            if (
              typeof (res as { flushHeaders?: () => void }).flushHeaders ===
              "function"
            ) {
              (res as { flushHeaders: () => void }).flushHeaders();
            }

            const writeEvent = (data: unknown) => {
              res.write(`${JSON.stringify(data)}\n`);
            };

            try {
              const videoPath = path.join(ROOT, "out", episodeId, "video.mp4");
              const coverPath = path.join(ROOT, "out", episodeId, "cover.jpg");
              const alreadyRendered =
                fs.existsSync(videoPath) && fs.existsSync(coverPath);

              if (!alreadyRendered) {
                await renderEpisode({
                  episodeId,
                  episodeDir,
                  onProgress: (p) => {
                    writeEvent({ type: "progress", ...p });
                  },
                });
              }

              writeEvent({
                type: "done",
                downloadUrl: "/api/export/download",
                filename: `${episodeId}.mp4`,
                skipped: alreadyRendered,
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
            const episodeId = requireEpisodeId(req, url, defaultEpisodeId);
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

          if (req.method === "POST" && pathname === "/api/schedule") {
            const episodeId = requireEpisodeId(req, url, defaultEpisodeId);
            const episodeDir = path.join(SOURCE_DIR, episodeId);
            if (!fs.existsSync(episodeDir)) {
              return sendJson(res, 404, {
                error: `Episode not found: ${episodeId}`,
              });
            }

            const writeEvent = sendNdjson(res, (data) => {
              res.write(`${JSON.stringify(data)}\n`);
            });

            try {
              await withConsoleLogs(
                (line) => writeEvent({ type: "log", line }),
                () => runSchedule([`source/${episodeId}`]),
              );
              writeEvent({ type: "done" });
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              writeEvent({ type: "error", error: message });
            }
            res.end();
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

export function resolveEpisodeId(argv: string[]): string | null {
  const positional = argv.filter((a) => !a.startsWith("-"));
  if (positional.length === 0) {
    return null;
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
