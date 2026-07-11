import { newPage, withBrowser } from "./browser";

/**
 * Opens Instagram (Meta Business Suite) and TikTok in the persistent Playwright
 * profile so you can log in once. Press Enter in the terminal when done.
 */
async function main() {
  console.log("[login] Launching headed browser with persistent profile...");
  console.log("[login] Log into Instagram (Meta) and TikTok, then return here.");

  await withBrowser(async (context) => {
    const ig = await newPage(context);
    const tt = await newPage(context);

    await Promise.all([
      ig.goto("https://business.facebook.com/latest/home", {
        waitUntil: "domcontentloaded",
      }),
      tt.goto("https://www.tiktok.com/login", {
        waitUntil: "domcontentloaded",
      }),
    ]);

    console.log("\n[login] Complete sign-in in both windows.");
    console.log("[login] Press Enter here when finished...\n");

    await new Promise<void>((resolve) => {
      process.stdin.resume();
      process.stdin.once("data", () => resolve());
    });

    console.log("[login] Session saved to .playwright/profile");
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
