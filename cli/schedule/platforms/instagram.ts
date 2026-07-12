import type { BrowserContext, Page } from "playwright";
import { fillContentEditable, newPage, readClipboard, settle, withBrowser } from '../browser';
import { META } from '../selectors';
import { TIMEOUTS } from '../timeouts';

import type {
  PlatformPublisher,
  ScheduleInput,
  ScheduleResult,
} from "../types";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateParts(publishAt: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .formatToParts(publishAt)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${pad2(Number(parts.month))}/${pad2(Number(parts.day))}/${parts.year}`,
    hour: String(parts.hour),
    // Always zero-pad — Meta's minutes spinbutton ignores a bare "0"
    minute: pad2(Number(parts.minute)),
    meridiem: String(parts.dayPeriod ?? "AM").toUpperCase(),
  };
}

/** Meta time spinbuttons often ignore .fill(); select-all + type + Tab commits. */
async function fillSpin(
  page: Page,
  name: "hours" | "minutes" | "meridiem",
  value: string,
): Promise<void> {
  const spin = page.getByRole("spinbutton", { name });
  await spin.click({ timeout: TIMEOUTS.dateTime });
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+A" : "Control+A",
  );
  await page.keyboard.type(value, { delay: 40 });
  await page.keyboard.press("Tab");
  await settle(page, 200);
}

function normalizeLink(clip: string): string | null {
  const raw = clip.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^(www\.)?(facebook|fb|instagram)\.com\//i.test(raw)) {
    return `https://${raw.replace(/^www\./, "")}`;
  }
  if (/^\d+$/.test(raw)) return `https://facebook.com/${raw}`;
  return null;
}

function roleButton(page: Page, name: RegExp | string) {
  return page
    .locator('div[role="button"], button')
    .filter({ hasText: name })
    .first();
}

async function clickButton(
  page: Page,
  name: RegExp | string,
  timeout: number = TIMEOUTS.action,
): Promise<void> {
  // Playwright retries while aria-disabled; use longer timeout after uploads
  await roleButton(page, name).click({ timeout });
}

async function copyPostLink(page: Page, title: string): Promise<string> {
  const deadline = Date.now() + TIMEOUTS.linkPollTotal;

  while (Date.now() < deadline) {
    if (!page.url().includes("/scheduled_posts")) {
      await page.goto(META.scheduledPostsUrl, {
        waitUntil: "domcontentloaded",
        timeout: TIMEOUTS.navigation,
      });
    } else {
      await page
        .reload({ waitUntil: "domcontentloaded" })
        .catch(() => undefined);
    }
    await page
      .getByRole("tab", { name: "Scheduled" })
      .click({ timeout: TIMEOUTS.action })
      .catch(() => undefined);
    await settle(page, 1500);

    // ⋯ on the row whose cell contains our title
    const cell = page.getByRole("gridcell").filter({ hasText: title }).first();
    const menu = cell.locator('[role="button"][aria-haspopup="menu"]');
    if (await menu.isVisible().catch(() => false)) {
      await menu.click({ force: true, timeout: TIMEOUTS.action });
      const copy = page.getByText("Copy post link", { exact: true });
      try {
        await copy.waitFor({ state: "visible", timeout: 5_000 });
        await copy.click({ timeout: TIMEOUTS.action });
        await settle(page, 400);
        const url = normalizeLink(await readClipboard(page).catch(() => ""));
        if (url) return url;
      } catch {
        // Menu still loading / Copy post link not ready
      }
      await page.keyboard.press("Escape").catch(() => undefined);
    }

    await settle(page, TIMEOUTS.linkPollInterval);
  }

  throw new Error(
    `Instagram post link not found within ${TIMEOUTS.linkPollTotal / 1000}s`,
  );
}

async function scheduleReel(
  input: ScheduleInput,
  timeZone: string,
  context: BrowserContext,
): Promise<ScheduleResult> {
  const page = await newPage(context);
  const when = dateParts(input.publishAt, timeZone);

  console.log("[instagram] Create reel");
  await page.goto(META.homeUrl, {
    waitUntil: "commit",
    timeout: TIMEOUTS.navigation,
  });
  await clickButton(page, /^Create reel$/i, TIMEOUTS.navigation);

  console.log("[instagram] video");
  const [videoChooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: TIMEOUTS.fileChooser }),
    clickButton(page, /^Add Video$/i),
  ]);
  await videoChooser.setFiles(input.videoPath);
  await page
    .getByText(/video\.mp4|1080\s*[x×]\s*1920|100%/i)
    .first()
    .waitFor({ state: "visible", timeout: TIMEOUTS.videoUpload });

  console.log("[instagram] caption");
  await fillContentEditable(
    page,
    page.locator(META.captionEditorFallback).first(),
    input.title,
  );

  console.log("[instagram] cover");
  await page.getByText("Thumbnail", { exact: true }).scrollIntoViewIfNeeded();
  const mode = page.getByRole("button", { name: "Upload image" });
  if ((await mode.getAttribute("aria-pressed")) !== "true") {
    await mode.click({ timeout: TIMEOUTS.action });
  }
  const [coverChooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: TIMEOUTS.coverUpload }),
    page.getByRole("link", { name: "Upload image" }).click(),
  ]);
  await coverChooser.setFiles(input.coverPath);
  await settle(page, TIMEOUTS.settleMedium);

  console.log("[instagram] Next → Next → Schedule");
  await clickButton(page, /^Next$/i, TIMEOUTS.videoUpload);
  await settle(page, TIMEOUTS.settleMedium);
  await clickButton(page, /^Next$/i, TIMEOUTS.videoUpload);
  await page
    .getByText(/Scheduling options/i)
    .first()
    .waitFor({ state: "visible", timeout: TIMEOUTS.scheduleUi });

  await page
    .getByRole("button", { name: "Schedule", exact: true })
    .first()
    .click({ timeout: TIMEOUTS.scheduleUi });

  const dateBox = page.getByRole("textbox", { name: /Date picker/i });
  await dateBox.click({ timeout: TIMEOUTS.dateTime });
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+A" : "Control+A",
  );
  await page.keyboard.type(when.date, { delay: 30 });
  await page.keyboard.press("Enter");

  console.log(
    `[instagram] schedule → ${when.date} ${when.hour}:${when.minute} ${when.meridiem}`,
  );
  await fillSpin(page, "hours", when.hour);
  await fillSpin(page, "minutes", when.minute);
  await fillSpin(page, "meridiem", when.meridiem);

  await page
    .getByRole("button", { name: "Schedule", exact: true })
    .last()
    .click({ timeout: TIMEOUTS.confirm });
  await settle(page, TIMEOUTS.settleMedium);

  console.log("[instagram] copy post link");
  const url = await copyPostLink(page, input.title);
  console.log(`[instagram] scheduled → ${url}`);

  return { url };
}

export function createInstagramPublisher(timeZone: string): PlatformPublisher {
  return {
    id: "instagram",
    schedule(input, context) {
      if (context) return scheduleReel(input, timeZone, context);
      return withBrowser((ctx) => scheduleReel(input, timeZone, ctx));
    },
  };
}
