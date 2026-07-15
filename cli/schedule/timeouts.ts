/** Explicit timeouts (ms) for schedule automation steps. */

export const TIMEOUTS = {
  /** Default Playwright action timeout per page */
  pageDefault: 5_000,

  /** Navigation / first paint (page loads need more than UI clicks) */
  navigation: 30_000,

  /** Page-load-dependent elements (composers, dialogs after navigation) */
  pageLoad: 15_000,

  /** Clicking primary CTAs (frontend updates) */
  action: 5_000,

  /** Short UI settle after a click */
  settle: 500,

  /** Medium settle (composer transitions) */
  settleMedium: 1_000,

  /** File chooser appearance (after page/composer load) */
  fileChooser: 15_000,

  /** Video upload + processing */
  videoUpload: 300_000,

  /** Cover/thumbnail upload */
  coverUpload: 30_000,

  /** Waiting for schedule controls */
  scheduleUi: 5_000,

  /** Date/time picker interactions */
  dateTime: 5_000,

  /** Final Schedule / confirm click */
  confirm: 5_000,

  /** Instagram/TikTok scheduled-list poll interval */
  linkPollInterval: 3_000,

  /** Max time to wait for post link after scheduling */
  linkPollTotal: 120_000,

  /** TikTok post-link appearance after schedule */
  postLink: 30_000,
} as const;
