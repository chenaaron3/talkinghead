import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { rebuildAllPropsIndex } from "../../cli/helpers/props-index";
import {
  IMAGE_EXTENSIONS,
  ROOT,
  SOURCE_DIR,
} from "../../cli/helpers/types";
import type { EpisodeProps, Transcript } from "../../src/lib/types";

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

/** Images living in the episode folder (not generated/). */
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

export function editorApiPlugin(episodeId: string): Plugin {
  return {
    name: "talking-head-editor-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const { pathname } = url;

        try {
          if (req.method === "GET" && pathname === "/api/episode") {
            const episodeDir = path.join(SOURCE_DIR, episodeId);
            const propsPath = path.join(episodeDir, "generated", "props.json");
            if (!fs.existsSync(propsPath)) {
              return sendJson(res, 404, {
                error: `No props.json for episode ${episodeId}`,
              });
            }
            const props = JSON.parse(
              fs.readFileSync(propsPath, "utf8"),
            ) as EpisodeProps;
            let transcript: Transcript | null = null;
            const transcriptPath = path.join(
              episodeDir,
              "generated",
              "transcript.json",
            );
            if (fs.existsSync(transcriptPath)) {
              transcript = JSON.parse(
                fs.readFileSync(transcriptPath, "utf8"),
              ) as Transcript;
            }
            return sendJson(res, 200, { episodeId, props, transcript });
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
            return sendJson(res, 200, { assets });
          }

          if (req.method === "PUT" && pathname === "/api/props") {
            const raw = await readBody(req);
            const body = JSON.parse(raw) as { props: EpisodeProps };
            if (!body.props || body.props.episodeId !== episodeId) {
              return sendJson(res, 400, { error: "Invalid props payload" });
            }

            for (const clip of body.props.bRolls ?? []) {
              const absPublic = path.join(ROOT, "public", clip.src);
              if (fs.existsSync(absPublic)) continue;
              const key = clip.src.replace(/^b-roll\//, "");
              const absSource = path.join(SOURCE_DIR, key);
              if (fs.existsSync(absSource)) {
                linkIntoPublic(absSource, clip.src);
              }
            }

            const propsPath = path.join(
              SOURCE_DIR,
              episodeId,
              "generated",
              "props.json",
            );
            writeJson(propsPath, body.props);
            // Rebuild Studio cache from all per-episode props.json files
            rebuildAllPropsIndex(body.props);

            return sendJson(res, 200, { ok: true });
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
              .split(path.sep)
              .join("/");
            linkIntoPublic(absSource, publicSrc);
            return sendJson(res, 200, { src: publicSrc });
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
  const propsPath = path.join(
    SOURCE_DIR,
    episodeId,
    "generated",
    "props.json",
  );
  if (!fs.existsSync(propsPath)) {
    throw new Error(`Episode not processed (missing props.json): ${episodeId}`);
  }
  return episodeId;
}
