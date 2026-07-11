# Talking Head

Automate TikTok-style talking-head edits with local Whisper + Remotion, then schedule to YouTube / Instagram / TikTok.

## What it does

1. Transcribes each episode with **whisper.cpp** via `@remotion/install-whisper-cpp` (`base.en`)
2. Builds jump-cuts that remove filler words + long gaps (source video stays untouched)
3. Overlays a yellow/black TikTok title and word-level captions
4. Preview in Remotion Studio or render to MP4
5. Schedule the render to **YouTube Shorts** (API), **Instagram Reels** + **TikTok** (Playwright)

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
```

Requires: Node 18+, pnpm, ffmpeg/ffprobe.  
First `pnpm process` downloads whisper.cpp + the model into `whisper.cpp/` (gitignored).

### Schedule setup (one-time)

1. **YouTube OAuth**
   - Google Cloud Console → enable **YouTube Data API v3**
   - Create OAuth client (Desktop app) → download JSON
   - Save as `secrets/youtube-credentials.json`
   - Run: `pnpm schedule:auth-youtube` and complete the browser consent

2. **Instagram + TikTok login**
   - Requires **Google Chrome** installed (Playwright uses your real Chrome, not Chromium-for-Testing — TikTok blocks the testing build)
   - Run: `pnpm schedule:login`
   - Sign into Meta Business Suite and TikTok in the opened windows
   - Press Enter in the terminal when done (session saved under `.playwright/profile`)

Cadence defaults live in `schedule.config.yaml` (`17:00` / `America/New_York`).

## Episode layout

```
config.default.yaml          # shared defaults (titleDurationSec, captionsAtATime)
schedule.config.yaml         # daily post time + platforms
source/
  day1/
    config.yaml              # overrides (title required)
    your-take.mov            # exactly one video file
    generated/               # created by `pnpm process`
```

## Commands

```bash
# Transcribe, build cuts/captions, and render
pnpm process -- source/day1
# → out/day1/video.mp4
# → out/day1/cover.jpg

# Force re-transcription (ignore cache), then render
pnpm process -- source/day1 --force

# Preview in Studio (pick TalkingHead-day1)
pnpm studio

# After verifying the render, schedule to all platforms
pnpm schedule -- source/day1

# Or a subset
pnpm schedule -- source/day1 --platforms youtube
```

Scheduling uses a one-per-day cadence from `schedule-manifest.json` (gitignored):

- No prior entries → today at the configured time if still ahead, else tomorrow
- Otherwise → day after the latest scheduled entry
- Partial failures are saved; re-run retries only missing platforms
- Fully scheduled episodes are refused (no double-post)

## Config

`config.default.yaml` is merged with `source/<episode>/config.yaml` (episode wins).

| Key | Default | Meaning |
|---|---|---|
| `title` | *(required per episode)* | Overlay text + post title/caption on all platforms |
| `titleDurationSec` | `5` | How long the title stays on screen |
| `captionsAtATime` | `1` | Words shown together in the caption line |

Whisper model, fillers, gap threshold, fade timing, etc. are hardcoded in `cli/helpers/constants.ts` and `src/lib/constants.ts`.

## Output

- `out/<episode>/video.mp4` — edited talking-head video
- `out/<episode>/cover.jpg` — first edited frame + large centered title (no captions)
- `schedule-manifest.json` — local schedule state + platform links
- Composition size: **1080×1920**
- FPS: taken from the source video
- Cuts happen at **render/preview time** via Remotion `Series` jump-cuts — the file under `source/` is never rewritten
# talkinghead
