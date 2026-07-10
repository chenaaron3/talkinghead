/**
 * Stable selectors from live UIs (prefer data-e2e / aria over hashed CSS).
 */

export const TIKTOK = {
  uploadUrl:
    "https://www.tiktok.com/tiktokstudio/upload?from=webapp&tab=video",
  contentUrl: "https://www.tiktok.com/tiktokstudio/content",
  fileInput: 'input[type="file"]',
  captionEditor: '[data-e2e="caption_container"] .public-DraftEditor-content',
  coverContainer: '[data-e2e="cover_container"]',
  scheduleContainer: '[data-e2e="schedule_container"]',
  postButton: '[data-e2e="post_video_button"]',
  videoLink: 'a[href*="/video/"]',
} as const;

export const META = {
  homeUrl: "https://business.facebook.com/latest/home",
  scheduledPostsUrl:
    "https://business.facebook.com/latest/posts/scheduled_posts",
  captionEditorFallback: 'div.notranslate._5rpu[role="textbox"]',
} as const;
