/** Words of the traveler share flow, in one place. Sample concept copy; no figure here is a real price. */
import type { StampStatus } from "@/lib/types";
import type { ShareFormat, ShareSubject } from "./data";

export const copy = {
  backToPassport: "Back to your passport",
  backToHub: "All share flows",
  back: "Back",
  steps: [
    { id: "stamped", label: "Stamped" },
    { id: "choose", label: "Choose" },
    { id: "design", label: "Design" },
    { id: "share", label: "Share" },
  ],
  head: {
    choose: {
      eyebrow: "Step 2 · What to share",
      title: "What do you want to share?",
      lead: "Each choice makes its own post and its own link. Your name travels in the link, so every friend who joins counts for you.",
    },
    design: {
      eyebrow: "Step 3 · Your post",
      title: "Make it yours",
      lead: "Pick a format and say it in your own words. The QR code and your link are part of the picture.",
    },
    share: {
      eyebrow: "Step 4 · Send it",
      title: "Share it your way",
      /** {charity} */
      lead: "Friends who scan or tap land on your page, can start their own passport and give to {charity} on its own site.",
    },
  },
  celebrate: {
    chip: "New stamp",
    /** {title} */
    title: "{title},",
    titleEm: "stamped.",
    lead: {
      /** {charity} {island} */
      verified: "{charity} confirmed your donation. Share your stamp, and friends who scan it can help {island} too.",
      /** {charity} */
      pending: "Your donation is waiting for {charity} to confirm it. You can share now: the post shows the stamp as pending, honestly.",
      /** {charity} */
      discovery: "A Discovery stamp is in your passport. Share it, and friends can collect theirs and support {charity}.",
    } satisfies Record<StampStatus, string>,
    cta: "Share your stamp",
    later: "Not now",
    promise: "Your post carries your own link and QR code.",
    statsLabel: "Your link so far (sample figures)",
    visits: "link visits",
    joined: "friends joined",
    gave: "gave to a charity",
    passportLine: "{n} of {total} {province} stamps",
  },
  subjects: {
    stamp: { title: "This stamp", short: "this stamp", blurb: "The stamp, large on your passport page.", lands: "Friends land on the island it came from." },
    island: { title: "This island", short: "this island", blurb: "The island's page, with the stamps you hold there.", lands: "Friends land on the island's page." },
    passport: { title: "My passport", short: "my passport", blurb: "Your cover and how far you have come.", lands: "Friends land on your passport." },
  } satisfies Record<ShareSubject, { title: string; short: string; blurb: string; lands: string }>,
  choose: {
    /** {what} */
    cta: "Share {what}",
    link: "Your link",
    island: "Which island?",
  },
  design: {
    cta: "Looks good",
    format: "Format",
    headline: "Your headline",
    headlineHint: "Shown on the picture. Keep it short.",
    ideas: "Ideas",
    style: "Passport style",
    styleHint: "The post uses the look of your passport.",
    island: "Island",
  },
  formats: {
    story: { name: "Story", hint: "9:16" },
    feed: { name: "Feed post", hint: "4:5" },
    film: { name: "Passport film", hint: "Concept" },
  } satisfies Record<ShareFormat, { name: string; hint: string }>,
  film: {
    tag: "Concept: export as video",
    title: "The passport film",
    body: "Your passport opens, turns through your islands, closes, and turns over to a code that says “Scan to help my charity”. It plays here as a live preview of the idea.",
    note: "A concept to react to, not a settled feature. How the real video is made (on the phone or on a server) is still open.",
    save: "Save video",
    /** {percent} */
    saving: "Recording {percent}%",
    /** {ext} */
    saved: "Saved as .{ext}",
    again: "Save again",
    /** {seconds} {ext} */
    saveHint: "A bonus: records the preview as it plays, about {seconds} seconds, as a .{ext} file.",
    inApp: "You are inside an app's own browser, where saving a file can be blocked. If nothing is saved, open this page in your phone's browser.",
    unsupported: "This browser cannot record the preview, so there is nothing to save here. The film still plays.",
    failed: "The recording did not finish. The film still plays; try again in your phone's main browser.",
  },
  share: {
    cta: "Share",
    sheetTitle: "Share your post",
    sheetFilm: "Passport film (concept). The picture saved here is its last frame.",
    linkTitle: "Your link and code",
    linkHint: "Your name is in the link, so friends who join through it count for you.",
    statsLabel: "Your link so far (sample figures)",
    visits: "visits",
    joined: "friends joined",
    gave: "gave to a charity",
    sample: "Sample figures",
    edit: "Change the post",
    /** {charity} */
    discovery: "This is a Discovery stamp: no donation has been made or claimed. It upgrades only if {charity} confirms one.",
    seeLanding: "See what your friend sees",
    /** {n} */
    done: "Nice. Your link is out there, with {n} stamps behind it.",
  },
  demo: {
    label: "Demo control",
    status: "Show the new stamp as",
  },
} as const;
