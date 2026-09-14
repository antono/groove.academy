// What an installed app needs on disk to be usable with no network.
//
// This is deliberately NOT "everything". Twelve kits and three basses come to
// ~10 MB, and a kit the student has not chosen is not something they are about
// to hear. The set below is the configured kit, the basses, the catalogue and
// the lessons — around 1 MB, most of which any student who has practised at all
// already has cached.
//
// Warming this is triggered by the app being *installed* (see $lib/pwa), never
// by an ordinary first visit: the service worker installs for everyone,
// including someone who will read one news post and leave, and spending their
// bandwidth on drum samples is what the warm-on-idle design exists to avoid.

import { base } from "$app/paths";
import { DRUM_NOTES, drumUrl } from "$lib/drums";
import { sampleUrl } from "$lib/sampler";
import type { Manifest } from "$lib/catalogue";

/**
 * Pages precached so an offline launch can reach them.
 *
 * Written by hand and therefore able to rot — a new top-level route will be
 * missed here. That is survivable rather than silent: the service worker falls
 * back to /offline for anything not listed, so the failure mode is a page that
 * says it is unavailable rather than a browser error. Keep it in step with the
 * nav links in +layout.svelte.
 */
export const OFFLINE_ROUTES = [
  "/",
  "/lessons",
  "/stats",
  "/onboarding",
  "/onboarding/keyboard",
  "/onboarding/touch",
  "/onboarding/midi",
  "/news",
  "/account",
  "/offline",
];

/** The bass sets a lesson MIDI can name. Small, and all three fit in a breath. */
const BASS_IDS = ["lately", "synth1", "synth2"];
const BASS_LO = 28;
const BASS_HI = 60;

/**
 * Every URL the offline set covers, for a given kit and catalogue.
 *
 * `manifest` may be null — a device that has never loaded the catalogue still
 * gets its kit and its pages, and the lessons follow on the next attempt.
 */
export function offlineUrls(kit: number, manifest: Manifest | null): string[] {
  const urls: string[] = [];

  for (const route of OFFLINE_ROUTES) urls.push(`${base}${route}`);

  urls.push(`${base}/lessons/manifest.json`);
  if (manifest) {
    for (const lesson of manifest.lessons) {
      urls.push(`${base}/lessons/${lesson.file}`);
      // The lesson's own page, so opening it offline renders rather than
      // falling through to /offline.
      urls.push(`${base}/lessons/${lesson.id}`);
    }
  }

  for (const note of DRUM_NOTES) urls.push(drumUrl(kit, note));

  for (const id of BASS_IDS)
    for (let note = BASS_LO; note <= BASS_HI; note++)
      urls.push(sampleUrl("bass", id, note));

  return urls;
}
