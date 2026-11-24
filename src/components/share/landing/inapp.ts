/**
 * In-app browser detection for the recipient page.
 *
 * Most people who follow a shared link arrive inside the embedded browser of a social app
 * (Technical_Questions.md, section 1). The page works there, but a sign-in link tapped in an email
 * opens the phone's default browser instead, and saving pictures is unreliable. So the page shows
 * a gentle, dismissible "open in your browser" helper. It never blocks.
 *
 * None of this is tested on real devices yet: user-agent strings and menu wording change between
 * app versions, and the copy says so.
 */

export type InAppPlatform = "instagram" | "tiktok" | "facebook";
export type DeviceOs = "ios" | "android" | "other";

export interface InAppInfo {
  platform: InAppPlatform;
  os: DeviceOs;
  /** True when `?inapp=` forced it for the demo (the visitor is really in a normal browser). */
  simulated: boolean;
}

export const IN_APP_PLATFORMS: InAppPlatform[] = ["instagram", "tiktok", "facebook"];

export const PLATFORM_NAME: Record<InAppPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

export function isInAppPlatform(value: unknown): value is InAppPlatform {
  return typeof value === "string" && (IN_APP_PLATFORMS as string[]).includes(value);
}

export function detectOs(userAgent: string): DeviceOs {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}

/** Which social app's embedded browser this user agent belongs to, if any. */
export function detectPlatform(userAgent: string): InAppPlatform | null {
  if (/Instagram/i.test(userAgent)) return "instagram";
  if (/TikTok|musical_ly|BytedanceWebview|\btrill\b/i.test(userAgent)) return "tiktok";
  // Facebook and Messenger share one family of markers.
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger/i.test(userAgent)) return "facebook";
  return null;
}

/** `forced` is the `?inapp=` query value; it wins over the user agent so the demo can show each app. */
export function detectInApp(userAgent: string, forced?: string | null): InAppInfo | null {
  const os = detectOs(userAgent);
  if (isInAppPlatform(forced)) {
    const real = detectPlatform(userAgent);
    return { platform: forced, os, simulated: real !== forced };
  }
  const platform = detectPlatform(userAgent);
  return platform ? { platform, os, simulated: false } : null;
}

/** "Safari" on an iPhone, "Chrome" on Android, otherwise "your browser". */
export function browserName(os: DeviceOs): string {
  return os === "ios" ? "Safari" : os === "android" ? "Chrome" : "your browser";
}

export interface InAppSteps {
  /** Where the menu is. */
  menu: string;
  /** What to pick in it. */
  choose: string;
}

/**
 * How to leave each app's browser. Wording follows what the apps showed when the research was
 * written; the helper adds "wording varies by app version" underneath.
 */
export function openInBrowserSteps(platform: InAppPlatform, os: DeviceOs): InAppSteps {
  const target = os === "ios" ? "Open in Safari" : os === "android" ? "Open in Chrome" : "Open in browser";
  switch (platform) {
    case "instagram":
      return { menu: "Tap the ••• menu at the top right of this screen", choose: `Choose "Open in external browser"` };
    case "tiktok":
      return { menu: "Tap the ••• or share arrow at the top right", choose: `Choose "Open in browser"` };
    case "facebook":
      return { menu: "Tap the ••• menu in the corner of this screen", choose: `Choose "${target}" or "Open in external browser"` };
  }
}

/** Why it is worth the trouble, in the visitor's terms. */
export const IN_APP_REASONS = [
  { id: "signin", title: "Sign-in links land in the right place", text: "A link tapped in your email opens your phone's browser, not this tab." },
  { id: "save", title: "Saving and sharing work properly", text: "Pictures, your wallet pass and the share menu are unreliable inside app browsers." },
  { id: "keep", title: "Your passport is there tomorrow", text: "App browsers keep their own storage, separate from your everyday browser." },
] as const;
