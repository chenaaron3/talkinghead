import type { BrowserContext, Page } from "playwright";
import {
  fillContentEditable,
  newPage,
  settle,
  withBrowser,
} from "../browser";
import { TIKTOK } from "../selectors";
import { TIMEOUTS } from "../timeouts";
import type { PlatformPublisher, ScheduleInput, ScheduleResult } from "../types";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateParts(publishAt: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(publishAt)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parts.hour!.padStart(2, "0"),
    minute: pad2(Number(parts.minute)),
  };
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function parseMonthHeader(text: string): { year: number; month: number } | null {
  // Header is "July / 2026" (may use NBSP).
  const match = text
    .replace(/\u00a0/g, " ")
    .match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s*\/\s*(\d{4})\b/i,
    );
  if (!match) return null;
  const month = MONTH_NAMES.findIndex(
    (name) => name.toLowerCase() === match[1]!.toLowerCase(),
  );
  if (month < 0) return null;
  return { year: Number(match[2]), month: month + 1 };
}

/** Advance/rewind the open calendar until the header matches year/month. */
async function navigateCalendarToMonth(
  page: Page,
  year: number,
  month: number,
): Promise<void> {
  const header = page.locator(".scheduled-picker .month-header-wrapper");
  await header.waitFor({ state: "visible", timeout: TIMEOUTS.dateTime });
  const arrows = header.locator("span.arrow");
  const targetKey = year * 12 + month;

  for (let i = 0; i < 24; i++) {
    const raw = (await header.innerText()).trim();
    const current = parseMonthHeader(raw);
    if (!current) {
      throw new Error(`TikTok calendar header unreadable: "${raw}"`);
    }
    const currentKey = current.year * 12 + current.month;
    if (currentKey === targetKey) return;

    const arrow = currentKey < targetKey ? arrows.last() : arrows.first();
    await arrow.click({ timeout: TIMEOUTS.dateTime });
    await settle(page, 300);
  }

  throw new Error(
    `TikTok calendar did not reach ${MONTH_NAMES[month - 1]} / ${year}`,
  );
}

async function setScheduleDateTime(
  page: Page,
  schedule: ReturnType<Page["locator"]>,
  when: { date: string; hour: string; minute: string },
): Promise<void> {
  const fields = schedule.locator("input.TUXTextInputCore-input");
  await fields.first().waitFor({ state: "visible", timeout: TIMEOUTS.dateTime });

  console.log(`[tiktok] setting time → ${when.hour}:${when.minute}`);
  await fields.nth(0).click({ timeout: TIMEOUTS.dateTime });
  await settle(page, 400);
  await page
    .locator(".tiktok-timepicker-option-text.tiktok-timepicker-left")
    .filter({ hasText: new RegExp(`^${when.hour}$`) })
    .first()
    .click({ timeout: TIMEOUTS.dateTime });
  await page
    .locator(".tiktok-timepicker-option-text")
    .filter({ hasText: new RegExp(`^${when.minute}$`) })
    .last()
    .click({ timeout: TIMEOUTS.dateTime });
  await page.keyboard.press("Escape").catch(() => undefined);
  await settle(page, 300);

  console.log(`[tiktok] setting date → ${when.date}`);
  await fields.nth(1).click({ timeout: TIMEOUTS.dateTime });
  await settle(page, 500);

  const [year, month, dayNum] = when.date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  await navigateCalendarToMonth(page, year, month);

  // Selectable cells are span.day.valid (probe-verified). Next-month spillover
  // days reuse the same number without .valid — never use .last() here.
  await page
    .locator(".scheduled-picker span.day.valid")
    .filter({ hasText: new RegExp(`^${dayNum}$`) })
    .first()
    .click({ timeout: TIMEOUTS.dateTime });
  await settle(page, 500);

  const committed = await fields.nth(1).inputValue().catch(() => "");
  if (committed !== when.date) {
    throw new Error(
      `TikTok date not committed (wanted ${when.date}, got "${committed}")`,
    );
  }
  await page.keyboard.press("Escape").catch(() => undefined);
  await settle(page, 300);
}

async function capturePostLink(page: Page, title: string): Promise<string> {
  const deadline = Date.now() + TIMEOUTS.postLink;

  while (Date.now() < deadline) {
    await page.goto(TIKTOK.contentUrl, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.navigation,
    });
    await settle(page, 1500);

    // Link on the row whose text contains our title
    const link = page
      .locator(TIKTOK.videoLink)
      .filter({ hasText: title })
      .first();
    if (await link.isVisible({ timeout: 2_000 }).catch(() => false)) {
      let href = await link.getAttribute("href");
      if (href) {
        if (href.startsWith("/")) href = `https://www.tiktok.com${href}`;
        return href;
      }
    }
    await settle(page, TIMEOUTS.linkPollInterval);
  }

  throw new Error(
    `TikTok post link not found within ${TIMEOUTS.postLink / 1000}s`,
  );
}

async function scheduleVideo(
  input: ScheduleInput,
  timeZone: string,
  context: BrowserContext,
): Promise<ScheduleResult> {
  const page = await newPage(context);
  const when = dateParts(input.publishAt, timeZone);

  console.log("[tiktok] upload");
  await page.goto(TIKTOK.uploadUrl, {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUTS.navigation,
  });
  await page
    .locator(TIKTOK.fileInput)
    .first()
    .setInputFiles(input.videoPath);
  await page
    .locator(TIKTOK.coverContainer)
    .or(page.locator(TIKTOK.captionEditor))
    .first()
    .waitFor({ state: "visible", timeout: TIMEOUTS.videoUpload });

  console.log("[tiktok] description");
  await fillContentEditable(
    page,
    page.locator(TIKTOK.captionEditor).first(),
    input.title,
  );

  console.log("[tiktok] cover");
  const cover = page.locator(TIKTOK.coverContainer);
  await cover.getByText(/Edit cover/i).click({ timeout: TIMEOUTS.action });
  await page
    .getByRole("button", { name: /Upload cover/i })
    .waitFor({ state: "visible", timeout: TIMEOUTS.action });
  await page.locator('input[type="file"]').last().setInputFiles(input.coverPath);
  await page
    .getByRole("button", { name: /^Save$/i })
    .click({ timeout: TIMEOUTS.action });
  await settle(page, TIMEOUTS.settleMedium);

  console.log("[tiktok] schedule");
  const schedule = page.locator(TIKTOK.scheduleContainer);
  await schedule.scrollIntoViewIfNeeded();
  await schedule
    .locator("label")
    .filter({ hasText: /^Schedule$/i })
    .click({ timeout: TIMEOUTS.scheduleUi });
  await settle(page, 800);
  const scheduleRadio = schedule.locator(
    'input.Radio__input[value="schedule"]',
  );
  if (!(await scheduleRadio.isChecked().catch(() => false))) {
    await scheduleRadio.check({ force: true, timeout: TIMEOUTS.scheduleUi });
    await settle(page, 500);
  }

  const fields = schedule.locator("input.TUXTextInputCore-input");
  await fields.first().waitFor({ state: "visible", timeout: TIMEOUTS.dateTime });
  await setScheduleDateTime(page, schedule, when);

  console.log("[tiktok] post");
  const postBtn = page.locator(TIKTOK.postButton);
  await postBtn.click({ timeout: TIMEOUTS.videoUpload });
  await postBtn.click({ timeout: TIMEOUTS.confirm }).catch(() => undefined);

  console.log("[tiktok] copy post link");
  const url = await capturePostLink(page, input.title);
  console.log(`[tiktok] scheduled → ${url}`);
  return { url };
}

export function createTikTokPublisher(timeZone: string): PlatformPublisher {
  return {
    id: "tiktok",
    schedule(input, context) {
      if (context) return scheduleVideo(input, timeZone, context);
      return withBrowser((ctx) => scheduleVideo(input, timeZone, ctx));
    },
  };
}
