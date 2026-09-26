// Device presets and kit profiles — the two kinds of controller this app knows
// how to be set up against.
//
// Neither ever asserts a MIDI note. A grid preset supplies dimensions, a kit
// profile supplies geometry and drum roles, and the notes are always recorded
// during the capture step, because physical layouts and note maps vary by
// firmware, bank, and (on a drum module) whatever the last owner assigned from
// the front panel. This keeps autodetect useful without asserting hardware
// facts we can't guarantee.
//
// A profile describes a *model*. What a particular student's instrument turned
// out to be belongs to their Controller (see controller.svelte.ts).
//
// Grid is capped at 4×4 for now (see MAX_COLS / MAX_ROWS). Add rows/cols later
// by bumping those and appending presets.

export const MAX_COLS = 4;
export const MAX_ROWS = 4;

/**
 * Grid cell -> GM drum note for a full 4×4. Bottom row = groove core; smaller
 * grids take the *tail* so kick/snare/hats stay on the bottom row.
 */
export const DEFAULT_GRID_SOUNDS = [
  39, 56, 54, 55, 49, 51, 53, 52, 45, 47, 50, 44, 36, 38, 42, 46,
];

export type Preset = {
  id: string;
  label: string;
  /** matched (case-insensitive) against the MIDI input name */
  match: RegExp;
  cols: number;
  rows: number;
};

export const PRESETS: Preset[] = [
  { id: "mpd218", label: "Akai MPD218", match: /mpd\s?218/i, cols: 4, rows: 4 },
  { id: "mpd226", label: "Akai MPD226", match: /mpd\s?226/i, cols: 4, rows: 4 },
  {
    id: "mpk-mini",
    label: "Akai MPK Mini",
    match: /mpk\s?mini/i,
    cols: 4,
    rows: 2,
  },
  {
    id: "launchkey-mini",
    label: "Novation Launchkey Mini",
    match: /launchkey\s?mini/i,
    cols: 4,
    rows: 2,
  },
  {
    id: "launchpad",
    label: "Novation Launchpad",
    match: /launchpad/i,
    cols: 4,
    rows: 4,
  },
  {
    id: "maschine",
    label: "NI Maschine",
    match: /maschine/i,
    cols: 4,
    rows: 4,
  },
  { id: "atom", label: "PreSonus ATOM", match: /atom/i, cols: 4, rows: 4 },
];

/**
 * What a port calls itself, cleaned up and with the manufacturer folded in.
 *
 * Two reasons this exists. Drum modules are frequently OEM hardware sold under
 * someone else's name and their port name says nothing useful — a Millenium
 * MD-90 announces itself as `"e-drum"` by `"Medeli"`, who actually built it — so
 * the maker is often the only identifying half and matching on the name alone
 * cannot work.
 *
 * And port strings are not clean. That same module appends U+202D (a bidirectional
 * override) to its manufacturer; such characters are invisible, survive a copy,
 * and will happily flip the direction of any text rendered after them. They are
 * stripped here so neither a regex nor a page has to think about it.
 */
export function deviceIdentity(
  name: string | null | undefined,
  manufacturer?: string | null,
): string {
  return (
    `${name ?? ""} ${manufacturer ?? ""}`
      .normalize("NFKC")
      // zero-width and bidi formatting characters
      .replace(/[​-‏‪-‮⁦-⁩﻿]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** A device's display name, free of the control characters some ports carry. */
export function cleanDeviceName(name: string | null | undefined): string {
  return deviceIdentity(name).trim() || "Unknown device";
}

/** First preset whose pattern matches the device identity, or null. */
export function matchPreset(
  name: string | null | undefined,
  manufacturer?: string | null,
): Preset | null {
  const id = deviceIdentity(name, manufacturer);
  if (!id) return null;
  return PRESETS.find((p) => p.match.test(id)) ?? null;
}

// --- how an instrument is struck -------------------------------------------

/**
 * Whether a model is played with **sticks** or with **fingers**.
 *
 * This is the decision-grade axis for how many hits a student can land at one
 * instant, and it is deliberately its own catalogue rather than something read
 * off `kind`. `kind` says how a device is *drawn* — a grid of cells or a
 * schematic — which correlates with how it is played but is not the same
 * question. A Roland Octapad is struck with sticks and is not a kit schematic;
 * an Akai MPC has sixteen pads and is played with fingers.
 *
 * Unlike a pad's MIDI note — which the NUX DP-2000 proved only real hardware
 * can settle — this is a fact about an instrument's size and purpose that a
 * photograph answers. So this list is safe to extend from documentation, and is
 * broader than the profiles: it covers models we never draw.
 */
export type Struck = "sticks" | "fingers";

type StruckEntry = { label: string; match: RegExp; struck: Struck };

/**
 * Ordered, first match wins. Patterns are matched against `deviceIdentity()`
 * and are written to the model name, never to a manufacturer alone — a port's
 * manufacturer string has been observed carrying an unrelated device's maker.
 */
export const STRUCK_BY: StruckEntry[] = [
  // --- sticks: multipads and drum modules ---------------------------------
  // Big rubber or mesh pads at arm's length, hit with a stick. Two hands is the
  // ceiling however many pads there are; a bass pedal adds the third voice.
  { label: "Roland SPD-SX", match: /\bspd[-\s]?sx\b/i, struck: "sticks" },
  { label: "Roland SPD::ONE", match: /\bspd[-\s]?one\b/i, struck: "sticks" },
  {
    label: "Roland Octapad",
    match: /\boctapad\b|\bspd[-\s]?30\b/i,
    struck: "sticks",
  },
  { label: "Roland TD kit", match: /\btd[-\s]?\d{1,2}\b/i, struck: "sticks" },
  {
    label: "Yamaha DTX",
    match: /\bdtx[-\s]?(multi|\d)/i,
    struck: "sticks",
  },
  {
    label: "Alesis sample pad",
    match: /\bsamplepad\b|\bstrike\s?multipad\b/i,
    struck: "sticks",
  },
  {
    label: "Alesis kit",
    match: /\bnitro\b|\bsurge\b|\bcommand\b|\bcrimson\b/i,
    struck: "sticks",
  },
  { label: "NUX percussion pad", match: /\bdp-?\d{3,4}\b/i, struck: "sticks" },
  { label: "NUX DM kit", match: /\bdm-?\d{3}\b/i, struck: "sticks" },
  {
    label: "Medeli / Millenium module",
    match: /\bmedeli\b|\be-?drum\b|\bmps-?\d/i,
    struck: "sticks",
  },
  { label: "Donner drum kit", match: /\bded-?\d+\b/i, struck: "sticks" },

  // --- fingers: pad grids and groove boxes --------------------------------
  // Small pads under one hand, each independently reachable, so the practical
  // ceiling is the pad count rather than two.
  { label: "Akai MPD", match: /\bmpd\s?\d{3}\b/i, struck: "fingers" },
  { label: "Akai MPK", match: /\bmpk\b/i, struck: "fingers" },
  { label: "Akai MPC", match: /\bmpc\b/i, struck: "fingers" },
  { label: "Ableton Push", match: /\bpush\s?[23]?\b/i, struck: "fingers" },
  {
    label: "Novation Launchpad",
    match: /\blaunchpad\b/i,
    struck: "fingers",
  },
  { label: "Novation Launchkey", match: /\blaunchkey\b/i, struck: "fingers" },
  { label: "Novation Circuit", match: /\bcircuit\b/i, struck: "fingers" },
  { label: "NI Maschine", match: /\bmaschine\b/i, struck: "fingers" },
  { label: "Arturia BeatStep", match: /\bbeatstep\b/i, struck: "fingers" },
  {
    label: "Korg pad controller",
    match: /\bnanopad\d?\b|\bpadkontrol\b/i,
    struck: "fingers",
  },
  { label: "PreSonus ATOM", match: /\batom\b/i, struck: "fingers" },
  { label: "ESI Xjam", match: /\bxjam\b/i, struck: "fingers" },
  {
    label: "M-Audio Trigger Finger",
    match: /\btrigger\s?finger\b/i,
    struck: "fingers",
  },
];

/**
 * How this model is struck, or null when nothing in the catalogue describes it.
 *
 * Null is not a failure: it means "we do not know", and a caller should stay
 * permissive rather than guess. Telling a student a lesson is beyond them when
 * it is not is worse than saying nothing.
 */
export function strikeStyle(
  name: string | null | undefined,
  manufacturer?: string | null,
): Struck | null {
  const id = deviceIdentity(name, manufacturer);
  if (!id) return null;
  return STRUCK_BY.find((e) => e.match.test(id))?.struck ?? null;
}

// --- electronic kits -------------------------------------------------------

/**
 * What a pad stands for. This is identity, not sound: a student may assign an
 * unusual GM note to their hi-hat and it is still the kit's hi-hat, which is
 * what pedal handling and the playability check reason about.
 */
export type DrumRole =
  | "kick"
  | "snare"
  | "tom"
  | "hihat"
  | "crash"
  | "ride"
  | "perc";

export const ROLE_LABELS: Record<DrumRole, string> = {
  kick: "Kick",
  snare: "Snare",
  tom: "Tom",
  hihat: "Hi-hat",
  crash: "Crash",
  ride: "Ride",
  perc: "Percussion",
};

export type KitPad = {
  /** must match an element id in the profile's schematic */
  id: string;
  label: string;
  role: DrumRole;
  /** suggested GM percussion note; the student may change it */
  sound: number;
  /**
   * The note this pad sends on a *factory* unit, where that has been read off
   * real hardware. A starting value only: any captured note replaces it, and a
   * student who has retuned their module from its own front panel will differ.
   * Omit it rather than guess — an absent note means "capture will tell us",
   * which is always safe, while a wrong one silently misfires a drum.
   */
  note?: number;
  /** this one arrives via a footswitch jack rather than a pad */
  pedal?: "kick" | "hihat";
};

export type KitProfile = {
  id: string;
  label: string;
  /** matched (case-insensitive) against `deviceIdentity()` — name + maker */
  match: RegExp;
  /**
   * Set when the port identity narrows the device only to a *family* — an OEM
   * module sold under several brands, all announcing themselves identically.
   * The wizard then offers the profile without asserting the model, because a
   * port that cannot tell them apart means only the student can.
   */
  family?: string;
  /**
   * Path under static/ to a schematic whose drums are `<g id>`s matching the
   * pad ids. First-party assets only — the preview inlines this, so a
   * user-supplied file must never reach it. null = draw the neutral layout.
   */
  schematic: string | null;
  /**
   * Whether this model's pad notes mean what General MIDI says they mean.
   *
   * Defaults to true, which is the ordinary case: a module that sends 38 for
   * its snare is naming its own pads, and capture adopts that over any
   * suggestion written from a photograph.
   *
   * The NUX DP-2000 is the counterexample. Its notes sit squarely inside the GM
   * percussion range and mean nothing in it — pad 5 sends 50 ("High Tom") and
   * plays a kick — so adopting them assigns the wrong drum to every pad at
   * once. Setting this false keeps the profile's own sounds, which were read
   * off the instrument rather than guessed at.
   */
  gmNotes?: boolean;
  /**
   * Which pads sit at the corners of the instrument, for the corner gestures.
   *
   * Declared, not derived. `pads` is the order the wizard walks, and where a
   * drum physically sits is expressed in the schematic, which only the preview
   * reads — so a corner inferred from a pad's position in the list would be a
   * guess about the picture.
   *
   * Optional. A profile that omits it simply has no gestures, which is the
   * right failure: a guessed corner fires the wrong action from a pad the
   * student struck deliberately. Each name must be one of this profile's own
   * pads; `scripts/check-kits.py` enforces that.
   */
  corners?: {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
  };
  /** in the order the wizard walks them */
  pads: KitPad[];
};

export const KIT_PROFILES: KitProfile[] = [
  {
    // Tabletop module: seven velocity pads reading as a snare, three toms, a
    // hi-hat and two cymbals, plus jacks for a kick and a hi-hat footswitch.
    // The hi-hat sits oddly to the right of the snare rather than out to the
    // side — that is the real instrument, so that is what the schematic shows.
    //
    // It does not announce itself as an MD-90, or as a Millenium at all: the
    // port is `"e-drum"` by `"Medeli"`, the OEM behind Thomann's Millenium line.
    // So the maker is what identifies it, and only to the family — hence
    // `family` below, and hence the wizard asking rather than telling.
    id: "millenium-md-90",
    label: "Millenium MD-90",
    match: /\bmedeli\b|\be-?drum\b/i,
    family: "Medeli e-drum module",
    schematic: "/kits/millenium-md-90.svg",
    // Sounds confirmed against the hardware: this module is GM-mapped and sends
    // 38 / 42 / 48 / 45 / 43 / 49 / 51 / 36. The toms were guessed wrong here
    // (47 and 45) until a real unit said otherwise.
    pads: [
      { id: "snare", label: "Snare", role: "snare", sound: 38 },
      { id: "hihat", label: "Hi-hat", role: "hihat", sound: 42 },
      { id: "tom-1", label: "Tom 1", role: "tom", sound: 48 },
      { id: "tom-2", label: "Tom 2", role: "tom", sound: 45 },
      { id: "tom-3", label: "Floor tom", role: "tom", sound: 43 },
      { id: "crash", label: "Crash", role: "crash", sound: 49 },
      { id: "ride", label: "Ride", role: "ride", sound: 51 },
      {
        id: "kick",
        label: "Kick pedal",
        role: "kick",
        sound: 36,
        pedal: "kick",
      },
    ],
  },
  {
    // Eight equal pads in two rows of four, control strip along the top. No
    // pedals: the rear jacks (KICK, HH CTRL, TRIGGER IN) are empty on a bare
    // unit, so every drum arrives from a pad surface and there is no pedals
    // step to run.
    //
    // This module names its pads in GM *range* but not in GM *meaning*, hence
    // `gmNotes: false`. Read off a factory-reset unit, three times across two
    // resets — the note each pad sends against the drum the module actually
    // plays for it:
    //
    //     pad 1  note 38  tom          pad 5  note 50  KICK
    //     pad 2  note 40  tom          pad 6  note 45  SNARE
    //     pad 3  note 37  tom          pad 7  note 47  CLOSED HAT
    //     pad 4  note 48  ride         pad 8  note 41  OPEN HAT
    //
    // Believing those notes puts a tom on the kick, a tom on the snare and a
    // tom on both hi-hats, which is how this kit arrives unplayable.
    //
    // Note the NUX manual's own MIDI NOTE screenshot disagrees, showing
    // 36/38/40 for pads 1-3. A factory-reset unit contradicts it; the hardware
    // is the record. The notes are restored by MENU → RESET → RESET SYSTEM,
    // not by either kit-scoped reset — MIDI NOTE is a system setting.
    //
    // Matched on the port name alone. The manufacturer half of the identity is
    // not usable: Chrome reported this port as made by "Focusrite", which is
    // the maker of an unrelated interface on the same machine (the kit's own
    // USB vendor is NXP). That half varies with whatever else is plugged in.
    id: "nux-dp-2000",
    label: "NUX DP-2000",
    match: /\bnux\b.*\bdp[-\s]?2000\b/i,
    schematic: "/kits/nux-dp-2000.svg",
    gmNotes: false,
    // Two rows of four. The `again` diagonal is kick-and-ride, which is a real
    // drumming pair — harmless only because gestures are not recognised during
    // a run. The `next` diagonal is a tom with the open hat, which is not.
    corners: {
      topLeft: "tom-1",
      topRight: "ride",
      bottomLeft: "kick",
      bottomRight: "hihat-open",
    },
    pads: [
      { id: "tom-1", label: "Tom 1", role: "tom", sound: 48, note: 38 },
      { id: "tom-2", label: "Tom 2", role: "tom", sound: 45, note: 40 },
      { id: "tom-3", label: "Tom 3", role: "tom", sound: 43, note: 37 },
      { id: "ride", label: "Ride", role: "ride", sound: 51, note: 48 },
      { id: "kick", label: "Kick", role: "kick", sound: 36, note: 50 },
      { id: "snare", label: "Snare", role: "snare", sound: 38, note: 45 },
      {
        id: "hihat-closed",
        label: "Hi-hat (closed)",
        role: "hihat",
        sound: 42,
        note: 47,
      },
      {
        id: "hihat-open",
        label: "Hi-hat (open)",
        role: "hihat",
        sound: 46,
        note: 41,
      },
    ],
  },
];

/** First kit profile whose pattern matches the device identity, or null. */
export function matchKit(
  name: string | null | undefined,
  manufacturer?: string | null,
): KitProfile | null {
  const id = deviceIdentity(name, manufacturer);
  if (!id) return null;
  return KIT_PROFILES.find((p) => p.match.test(id)) ?? null;
}

export function kitProfile(id: string | null | undefined): KitProfile | null {
  if (!id) return null;
  return KIT_PROFILES.find((p) => p.id === id) ?? null;
}

export type DeviceMatch =
  | { kind: "edrum"; profile: KitProfile }
  | { kind: "grid"; preset: Preset }
  | null;

/**
 * One lookup answering "grid preset, kit profile, or neither" for a port name.
 * Kits are tried first: they are the more specific claim, and a kit that also
 * happened to match a grid pattern should still be set up as a kit.
 */
export function matchDevice(
  name: string | null | undefined,
  manufacturer?: string | null,
): DeviceMatch {
  const profile = matchKit(name, manufacturer);
  if (profile) return { kind: "edrum", profile };
  const preset = matchPreset(name, manufacturer);
  if (preset) return { kind: "grid", preset };
  return null;
}
