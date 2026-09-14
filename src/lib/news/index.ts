// The news feed. One entry per post, newest first.
//
// A post's `slug` is its permanent URL — `/news/2026-08-07-groove-academy-on-air`
// — and carries its own date, so the feed sorts and reads correctly from the URL
// alone and two posts on one day cannot collide. **A published slug never
// changes**: it is what has been shared, linked and indexed. Correct a title
// freely; leave the slug where it is.
//
// Bodies are Svelte components rather than a data format because a post gets to
// shape itself — lists, callouts, links into the app. Everything the listing and
// the link preview need (date, title, summary) lives here instead, so the index
// page never has to render a post to describe it.

import type { Component } from "svelte";

import OnAir from "./2026-08-07-groove-academy-on-air.svelte";
import LessonsThatFinish from "./2026-08-08-lessons-that-finish.svelte";
import PracticeOnEveryDevice from "./2026-08-11-practice-on-every-device.svelte";
import BringYourKit from "./2026-08-13-bring-your-kit.svelte";
import PlayWithoutAKit from "./2026-08-17-play-without-a-kit.svelte";
import FortyNewLessons from "./2026-08-22-forty-new-lessons.svelte";
import PlayAStyle from "./2026-09-14-play-a-style.svelte";

/** Every post body takes the Mastodon URL, so the handle is written once. */
export type NewsBody = Component<{ mastodon: string }>;

export type NewsEntry = {
  /** Permanent URL segment, `YYYY-MM-DD-slug`. Never changes once published. */
  slug: string;
  /** ISO date. Must match the slug's prefix — asserted below in dev. */
  date: string;
  title: string;
  /** One or two sentences: the listing blurb and the link-preview description. */
  summary: string;
  body: NewsBody;
};

export const MASTODON = "https://mastodon.social/@groove_academy";

export const NEWS: NewsEntry[] = [
  {
    slug: "2026-09-14-play-a-style",
    date: "2026-09-14",
    title: "Play a style",
    summary:
      "Thirty new lessons open the Music tier — rock, funk, hip-hop, house, " +
      "breaks and reggae, over two real electric basses — and setup now asks " +
      "what you play on instead of guessing it from your USB port.",
    body: PlayAStyle,
  },
  {
    slug: "2026-08-22-forty-new-lessons",
    date: "2026-08-22",
    title: "Forty new lessons, and an app to play them in",
    summary:
      "22 playable lessons become 62: Foundations grows to five stages with " +
      "Space, The Cymbals and Two Bars, Vocabulary opens on 16ths, triplets " +
      "and the shuffle — and Groove Academy installs to a home screen.",
    body: FortyNewLessons,
  },
  {
    slug: "2026-08-17-play-without-a-kit",
    date: "2026-08-17",
    title: "Play without a kit",
    summary:
      "Your computer keyboard and a grid of on-screen pads are now instruments " +
      "the app listens to, so a lesson is playable with no hardware and on a " +
      "phone for the first time — and the highway arrives from further off.",
    body: PlayWithoutAKit,
  },
  {
    slug: "2026-08-13-bring-your-kit",
    date: "2026-08-13",
    title: "Bring your kit",
    summary:
      "Electronic drum kits are set up as kits now, pedals and all, with your " +
      "own instrument drawn beside the lesson — and the catalogue opens on " +
      "four tiers instead of one long list.",
    body: BringYourKit,
  },
  {
    slug: "2026-08-11-practice-on-every-device",
    date: "2026-08-11",
    title: "Your practice, on every device",
    summary:
      "An optional account backs up your progress and stats and brings them " +
      "back on any device, a drummer's words land between lessons, and the " +
      "practice heatmap fits the window it is drawn in.",
    body: PracticeOnEveryDevice,
  },
  {
    slug: "2026-08-08-lessons-that-finish",
    date: "2026-08-08",
    title: "Lessons that finish, and a highway that fits",
    summary:
      "Patterns now land on the bar line instead of running out, four lessons " +
      "borrow a hi-hat to keep time against, the highway comes in three sizes, " +
      "and 4.5 Paradiddle Groove is written.",
    body: LessonsThatFinish,
  },
  {
    slug: "2026-08-07-groove-academy-on-air",
    date: "2026-08-07",
    title: "Groove Academy On Air!",
    summary:
      "Groove Academy is live: lessons scroll, your hits are scored, and your " +
      "practice history stays in your browser. No account, nothing to install.",
    body: OnAir,
  },
];

// Authoring mistakes that are invisible until someone follows a link: a slug
// whose date has drifted from the entry's, or a slug published twice (the
// second is unreachable — findNews returns the first). Both are cheap to check
// and only worth checking while writing, so this never ships.
if (import.meta.env.DEV) {
  for (const entry of NEWS) {
    if (!entry.slug.startsWith(`${entry.date}-`)) {
      throw new Error(
        `news: "${entry.slug}" does not start with its date ${entry.date}`,
      );
    }
  }
  const seen = new Set<string>();
  for (const { slug } of NEWS) {
    if (seen.has(slug)) throw new Error(`news: duplicate slug "${slug}"`);
    seen.add(slug);
  }
}

export const findNews = (slug: string): NewsEntry | undefined =>
  NEWS.find((entry) => entry.slug === slug);

const MONTHS = [
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
];

/**
 * "2026-08-07" -> "7 August 2026".
 *
 * Parsed by hand rather than through `Date`: `new Date("2026-08-07")` is UTC
 * midnight, so anywhere west of Greenwich it formats as the 6th and the post
 * appears to be dated a day before its own URL.
 */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}
