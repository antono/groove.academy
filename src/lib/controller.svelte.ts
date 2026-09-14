// Controller — the student's instrument, and the one thing that knows what it
// is and what its inputs mean.
//
// Before this existed, every page assembled the instrument for itself: the
// lessons page held a note map, a transport binding, a grid size and a pad-drum
// list as four separate pieces of state rebuilt on every device change; the
// wizard wrote the same blob from a different set of variables; settings from a
// third. A second kind of instrument would have meant a second special case in
// each of them.
//
// So: one object. It answers what the device is (identity, kind, metadata),
// what an arriving MIDI message means (`handle`), which drums it can produce
// (`drums` / `canPlay`), and how it is drawn (`geometry`, read by
// controller-preview.svelte). It is the only reader and writer of the stored
// configuration.
//
// The line it does not cross: the Controller knows about the *device*. It knows
// nothing about lessons, scoring, samples or the audio clock. `handle()` states
// a fact about a message; what that fact is worth is the page's business.
//
// Runes live in a `.svelte.ts` module so the preview stays reactive when it
// reads pad state and pedal position.

import { DEFAULT_KIT, STORAGE_PREFIX } from "$lib/config";
import {
  DEFAULT_GRID_SOUNDS,
  kitProfile,
  type DrumRole,
  type KitProfile,
} from "$lib/presets";
import {
  asBinding,
  asControl,
  parseControl,
  sameControl,
  type MidiControl,
  type TransportBinding,
} from "$lib/transport-control";

/** GM percussion notes for the hi-hat's two voices. */
export const CLOSED_HAT = 42;
export const OPEN_HAT = 46;

/**
 * First synthetic pad note for a virtual controller (keyboard / on-screen pads).
 * Above the 0-127 MIDI range so it can never collide with a real captured note;
 * see `Controller.virtual`.
 */
export const SYNTHETIC_NOTE_BASE = 128;

/**
 * True when a note is one we have a drum sample for — the range `DRUM_NOTES`
 * renders (see drums.ts).
 *
 * Drum modules are overwhelmingly GM-mapped: a Millenium MD-90 sends 38 for its
 * snare, 42 for the closed hat, 48/45/43 for its toms. When a kit says which
 * drum it thinks a pad is, believing it beats any suggestion a profile could
 * carry — profiles are written from photographs, the module is the instrument.
 * So an e-drum pad whose captured note lands in this range takes that note as
 * its sound.
 *
 * Deliberately not applied to pad grids: an MPD218's notes are just pad
 * addresses and mean nothing about drums, which is what DEFAULT_GRID_SOUNDS is
 * for.
 */
export function isDrumNote(note: number): boolean {
  return note >= 35 && note <= 70;
}

export type ControllerKind = "grid" | "edrum";

export type Pad = {
  id: string;
  label: string;
  role: DrumRole;
  /** captured controller note; null = not mapped */
  note: number | null;
  /** GM percussion note this pad plays */
  sound: number;
  /**
   * A second controller note that is still *this* drum. Only a two-note hi-hat
   * uses it: one physical hat sending one note open and another closed. Keeping
   * it on the one pad is what lets the schematic light a single hi-hat however
   * the kit is wired.
   */
  altNote?: number | null;
  altSound?: number;
  /** arrives via a footswitch jack rather than a pad surface */
  pedal?: "kick" | "hihat";
};

/**
 * How the preview should draw this controller. A grid keeps its captured
 * dimensions, a profiled kit points at its schematic, and anything else falls
 * back to the neutral arrangement rather than being drawn as a rectangle it
 * isn't.
 */
export type Geometry =
  | { kind: "grid"; cols: number; rows: number }
  | { kind: "schematic"; src: string }
  | { kind: "neutral" };

/**
 * How this kit's hi-hat behaves, as discovered by the wizard's pedal step.
 *
 *   two-note — open and closed strikes send different notes. Needs no state,
 *              which is why it is preferred wherever it is observed.
 *   stateful — both strikes send one note and the pedal speaks for itself, so
 *              its position has to be tracked.
 *   none     — no usable pedal. One voice; open-hat targets are unreachable,
 *              which `canPlay` reports so the lesson page can say so.
 */
export type HihatMode = "two-note" | "stateful" | "none";

export type HihatConfig = {
  mode: HihatMode;
  /** stateful: the message the pedal itself emits */
  pedal: MidiControl | null;
  /** the GM notes the two voices play */
  closed: number;
  open: number;
};

/**
 * What an arriving message meant. `none` rather than null is deliberate: an
 * unrecognised message is a fact the controller states, which is what lets the
 * wizard's test step say "something arrived that isn't mapped" without a second
 * code path.
 */
export type ControllerEvent =
  | { kind: "hit"; note: number; velocity: number; pad: Pad }
  | { kind: "pedal"; which: "hihat" | "kick"; down: boolean }
  | { kind: "transport"; which: "start" | "stop" }
  /** a note-on from something this controller has no pad for */
  | { kind: "unmapped"; note: number }
  | { kind: "none" };

/** Enough to name a controller in a chooser without loading the whole thing. */
export type ControllerSummary = {
  deviceId: string;
  name: string;
  kind: ControllerKind;
  profile: string | null;
  padCount: number;
  lastUsed: string | null;
};

const NONE: ControllerEvent = { kind: "none" };

function defaultHihat(): HihatConfig {
  return { mode: "none", pedal: null, closed: CLOSED_HAT, open: OPEN_HAT };
}

/**
 * Best guess at what a GM note is, for labelling pads on a grid controller that
 * was configured before roles existed. Only ever a label — a grid pad's role is
 * never load-bearing the way a kit pad's is.
 */
function roleForSound(gm: number): DrumRole {
  if (gm === 35 || gm === 36) return "kick";
  if (gm === 38 || gm === 40 || gm === 37) return "snare";
  if (gm === 42 || gm === 44 || gm === 46) return "hihat";
  if (gm === 49 || gm === 57 || gm === 55 || gm === 52) return "crash";
  if (gm === 51 || gm === 59 || gm === 53) return "ride";
  if (gm >= 41 && gm <= 50) return "tom";
  return "perc";
}

export class Controller {
  readonly deviceId: string;
  readonly kind: ControllerKind;
  /** kit profile id, grid preset id, "custom", or null */
  readonly profile: string | null;

  name = $state("");
  kitId = $state(DEFAULT_KIT);
  pads = $state<Pad[]>([]);
  geometry = $state<Geometry>({ kind: "neutral" });
  hihat = $state<HihatConfig>(defaultHihat());
  transport = $state<TransportBinding>({ start: null, stop: null });
  lastUsed = $state<string | null>(null);

  /**
   * Where the hi-hat pedal is right now, for a stateful kit. Read by the
   * preview so the picture shows the pedal the student is holding; null when
   * this controller has no pedal to show.
   */
  hihatPosition = $state<"open" | "closed" | null>(null);

  /**
   * Pin the hi-hat to one voice, or null to let the pedal decide.
   *
   * A pedal at rest is *open*, which is right for a drummer and wrong for a
   * student: material here is overwhelmingly closed hats, and holding a
   * footswitch down for a whole lesson to make them count is absurd. So a
   * caller that knows only one voice is wanted says so, and the ambiguity is
   * spent on that instead of on the pedal.
   *
   * Deliberately a bare note, not a lesson: the Controller knows what the
   * *device* means and nothing about what is being played on it. Who decides,
   * and from what, is the caller's business.
   */
  hihatPreference = $state<number | null>(null);

  /**
   * controller note -> the pad it belongs to and the GM note that note plays,
   * rebuilt whenever the pads change. Two entries can point at one pad (a
   * two-note hi-hat), which is why the sound lives here and not only on the pad.
   */
  #byNote = new Map<number, { pad: Pad; sound: number }>();

  constructor(init: {
    deviceId: string;
    kind: ControllerKind;
    profile?: string | null;
    name?: string;
  }) {
    this.deviceId = init.deviceId;
    this.kind = init.kind;
    this.profile = init.profile ?? null;
    this.name = init.name ?? "";
    if (this.kind === "edrum") this.hihatPosition = "closed";
  }

  // --- construction --------------------------------------------------------

  /** A blank controller for a kit profile: its pads, its geometry, no notes. */
  static fromProfile(
    deviceId: string,
    name: string,
    profile: KitProfile,
  ): Controller {
    const c = new Controller({
      deviceId,
      kind: "edrum",
      profile: profile.id,
      name,
    });
    c.setPads(
      profile.pads.map((p) => ({
        id: p.id,
        label: p.label,
        role: p.role,
        note: null,
        sound: p.sound,
        ...(p.pedal ? { pedal: p.pedal } : {}),
      })),
    );
    c.geometry = profile.schematic
      ? { kind: "schematic", src: profile.schematic }
      : { kind: "neutral" };
    return c;
  }

  /** A blank controller for a kit with no profile — the generic path. */
  static custom(deviceId: string, name: string, pads: Pad[]): Controller {
    const c = new Controller({
      deviceId,
      kind: "edrum",
      profile: "custom",
      name,
    });
    c.setPads(pads);
    c.geometry = { kind: "neutral" };
    return c;
  }

  /**
   * A virtual controller — a computer keyboard or an on-screen pad grid. It has
   * no MIDI port and captures no controller note, so its pads carry a *synthetic*
   * note (>= 128, out of MIDI range) purely so the rest of the app — `drums`,
   * `canPlay`, the schematic, the device line — reads them as mapped. Hits from a
   * virtual source resolve pad -> GM directly and never pass through `handle()`,
   * so that synthetic note is never matched against a real message.
   */
  static virtual(deviceId: string, name: string, pads: Pad[]): Controller {
    const c = new Controller({
      deviceId,
      kind: "grid",
      profile: "virtual",
      name,
    });
    c.setPads(
      pads.map((p, i) => ({ ...p, note: p.note ?? SYNTHETIC_NOTE_BASE + i })),
    );
    const cols = Math.min(4, pads.length);
    c.geometry = { kind: "grid", cols, rows: Math.ceil(pads.length / cols) };
    return c;
  }

  /**
   * A blank grid controller. Its pads are synthesised with positional labels,
   * so the Controller has one internal shape and only `geometry` differs —
   * which is the whole reason this abstraction pays: `kind` is consulted when
   * building a controller and essentially nowhere afterwards.
   */
  static grid(
    deviceId: string,
    name: string,
    cols: number,
    rows: number,
    presetId: string | null = null,
  ): Controller {
    const c = new Controller({
      deviceId,
      kind: "grid",
      profile: presetId,
      name,
    });
    const total = cols * rows;
    const sounds = DEFAULT_GRID_SOUNDS.slice(
      DEFAULT_GRID_SOUNDS.length - total,
    );
    c.setPads(
      Array.from({ length: total }, (_, i) => ({
        id: `pad-${i}`,
        label: `Pad ${i + 1}`,
        role: roleForSound(sounds[i] ?? 38),
        note: null,
        sound: sounds[i] ?? 38,
      })),
    );
    c.geometry = { kind: "grid", cols, rows };
    return c;
  }

  // --- pads ----------------------------------------------------------------

  setPads(pads: Pad[]) {
    this.pads = pads;
    this.#reindex();
  }

  setPadNote(index: number, note: number | null) {
    if (index < 0 || index >= this.pads.length) return;
    this.pads[index] = { ...this.pads[index], note };
    this.pads = [...this.pads];
    this.#reindex();
  }

  setPadSound(index: number, sound: number) {
    if (index < 0 || index >= this.pads.length) return;
    this.pads[index] = { ...this.pads[index], sound };
    this.pads = [...this.pads];
    this.#reindex();
  }

  padById(id: string): Pad | undefined {
    return this.pads.find((p) => p.id === id);
  }

  #reindex() {
    const m = new Map<number, { pad: Pad; sound: number }>();
    for (const p of this.pads) {
      if (p.note != null) m.set(p.note, { pad: p, sound: p.sound });
      if (p.altNote != null) {
        m.set(p.altNote, { pad: p, sound: p.altSound ?? OPEN_HAT });
      }
    }
    this.#byNote = m;
  }

  // --- input ---------------------------------------------------------------

  /**
   * Turn a raw MIDI message into what it means.
   *
   * Deliberately does NOT debounce. Pads bounce a note-on during *capture*,
   * where the wizard filters them, but a run needs every hit: a 160 ms window
   * would swallow 16ths at 120 BPM and quietly cost the student a roll.
   */
  handle(data: Uint8Array | number[]): ControllerEvent {
    // parseControl already drops the realtime firehose (clock, active sensing)
    // and anything that can't be a button or a pad.
    const parsed = parseControl(data);
    if (!parsed) return NONE;
    const { control, pressed } = parsed;

    // Pads are checked first: a pad always plays its drum, even if a stale
    // config also bound that note to a transport button.
    const padEntry =
      control.kind === "note" && pressed
        ? this.#byNote.get(control.data1)
        : undefined;

    if (!padEntry) {
      if (pressed && sameControl(control, this.transport.start)) {
        return { kind: "transport", which: "start" };
      }
      if (pressed && sameControl(control, this.transport.stop)) {
        return { kind: "transport", which: "stop" };
      }

      // The hi-hat pedal is control, not performance: it moves the position and
      // leaves as a pedal event, so it can never reach scoring and be banked as
      // an extra note on every close.
      if (this.hihat.pedal && sameControl(control, this.hihat.pedal)) {
        this.hihatPosition = pressed ? "closed" : "open";
        return { kind: "pedal", which: "hihat", down: pressed };
      }
    }

    if (control.kind !== "note" || !pressed) return NONE;
    const entry = padEntry;
    // A note-on with no pad behind it is a fact worth stating: it is how the
    // wizard's test step can say "that pad isn't mapped" rather than showing
    // nothing at all.
    if (!entry) return { kind: "unmapped", note: control.data1 };

    const velocity = data.length > 2 ? data[2] : 127;
    return {
      kind: "hit",
      note: this.#resolve(entry),
      velocity,
      pad: entry.pad,
    };
  }

  /**
   * The one place a note is allowed to be ambiguous, and the place that spends
   * it: by the time a hit is reported, scoring, playback and highlighting all
   * see one unambiguous GM note.
   *
   * A two-note hi-hat needs nothing here — which note arrived already said
   * which voice it was, and that is why it is preferred wherever it is observed.
   */
  #resolve(entry: { pad: Pad; sound: number }): number {
    if (entry.pad.role !== "hihat") return entry.sound;
    // A pinned voice wins over both the pedal and the wiring: it means only one
    // voice is wanted, so every way of striking the hat should produce it.
    if (this.hihatPreference != null) return this.hihatPreference;
    if (this.hihat.mode !== "stateful") return entry.sound;
    return this.hihatPosition === "open" ? this.hihat.open : this.hihat.closed;
  }

  /** True when this controller has a hi-hat mapped at all, however it is wired. */
  get hasHihat(): boolean {
    return this.pads.some(
      (p) => p.role === "hihat" && (p.note != null || p.altNote != null),
    );
  }

  // --- capability ----------------------------------------------------------

  /** Every GM note this controller can produce. */
  get drums(): Set<number> {
    const out = new Set<number>();
    for (const p of this.pads) {
      if (p.note == null && p.altNote == null) continue;
      if (p.note != null) out.add(p.sound);
      if (p.altNote != null) out.add(p.altSound ?? OPEN_HAT);
      if (p.role === "hihat" && this.hihat.mode === "stateful") {
        out.add(this.hihat.closed);
        out.add(this.hihat.open);
      }
    }
    // A pinned voice is producible by definition — that is what pinning means,
    // and it is how a single-voice kit can still play a lesson written for the
    // voice it doesn't natively send.
    if (this.hihatPreference != null && this.hasHihat) {
      out.add(this.hihatPreference);
    }
    return out;
  }

  canPlay(gmNote: number): boolean {
    return this.drums.has(gmNote);
  }

  /** Which of `notes` this controller cannot produce, in the order given. */
  missing(notes: Iterable<number>): number[] {
    const have = this.drums;
    const out: number[] = [];
    for (const n of notes) if (!have.has(n) && !out.includes(n)) out.push(n);
    return out;
  }

  // --- persistence ---------------------------------------------------------

  /**
   * The pads are the source of truth. `notes` / `soundNotes` are regenerated
   * from them on every save so the two representations cannot disagree, and so
   * a reader that never learned this class still gets a working map.
   */
  toJSON(): Record<string, unknown> {
    // The mirror is flattened: a two-note hi-hat contributes both of its notes,
    // so a reader that only understands the two parallel arrays still sounds
    // the right drum for either strike.
    const mapped = this.pads.flatMap((p) => [
      ...(p.note != null ? [{ note: p.note, sound: p.sound }] : []),
      ...(p.altNote != null
        ? [{ note: p.altNote, sound: p.altSound ?? OPEN_HAT }]
        : []),
    ]);
    const base: Record<string, unknown> = {
      kind: this.kind,
      profile: this.profile,
      deviceName: this.name,
      lastUsed: this.lastUsed,
      pads: this.pads,
      hihat: this.hihat,
      kit: this.kitId,
      transport: this.transport,
      notes: mapped.map((p) => p.note),
      soundNotes: mapped.map((p) => p.sound),
    };
    if (this.geometry.kind === "grid") {
      base.cols = this.geometry.cols;
      base.rows = this.geometry.rows;
    }
    return base;
  }

  /** Best-effort, like every other store here: blocked storage is not an error. */
  save() {
    this.lastUsed = new Date().toISOString();
    try {
      localStorage.setItem(
        STORAGE_PREFIX + this.deviceId,
        JSON.stringify(this.toJSON()),
      );
      // Saving no longer decides what is *active*: that is one answer now, owned
      // by active-instrument.svelte.ts, and a flow that saves a second kit must
      // not silently steal the selection from the one being played.
    } catch {
      /* private mode — the session still plays, it just isn't remembered */
    }
  }

  static load(deviceId: string): Controller | null {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_PREFIX + deviceId);
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      return Controller.fromStored(deviceId, JSON.parse(raw));
    } catch {
      return null;
    }
  }

  /**
   * Rebuild from a stored blob. A config with no `kind` marker is a pad grid
   * saved before this class existed and is read exactly as it always was — no
   * migration, and nothing is rewritten on read.
   */
  static fromStored(deviceId: string, cfg: unknown): Controller | null {
    if (!cfg || typeof cfg !== "object") return null;
    const d = cfg as Record<string, any>;
    const kind: ControllerKind = d.kind === "edrum" ? "edrum" : "grid";
    const c = new Controller({
      deviceId,
      kind,
      profile: typeof d.profile === "string" ? d.profile : null,
      name: typeof d.deviceName === "string" ? d.deviceName : "",
    });

    if (Array.isArray(d.pads) && d.pads.length) {
      c.setPads(d.pads.map(asPad));
    } else if (Array.isArray(d.notes) && Array.isArray(d.soundNotes)) {
      // Legacy grid: synthesise pads from the two parallel arrays.
      c.setPads(
        d.notes.map((note: unknown, i: number) => {
          const sound =
            typeof d.soundNotes[i] === "number" ? d.soundNotes[i] : 38;
          return {
            id: `pad-${i}`,
            label: `Pad ${i + 1}`,
            role: roleForSound(sound),
            // 0 was the wizard's "not captured" filler, never a real pad note.
            note: typeof note === "number" && note > 0 ? note : null,
            sound,
          };
        }),
      );
    } else {
      return null; // not a device config — some other key under our prefix
    }

    if (typeof d.cols === "number" && typeof d.rows === "number") {
      c.geometry = { kind: "grid", cols: d.cols, rows: d.rows };
    } else {
      const profile = kitProfile(c.profile);
      c.geometry = profile?.schematic
        ? { kind: "schematic", src: profile.schematic }
        : { kind: "neutral" };
    }

    c.hihat = asHihat(d.hihat);
    c.hihatPosition = c.hihat.mode === "stateful" ? "closed" : null;
    c.transport = asBinding(d.transport);
    if (typeof d.kit === "number") c.kitId = d.kit;
    if (typeof d.lastUsed === "string") c.lastUsed = d.lastUsed;
    return c;
  }

  /**
   * Every controller configured on this machine, most recently used first, so a
   * device chooser can name one rather than repeating a raw MIDI port name.
   *
   * The storage prefix is shared with per-lesson keys (`bpm:`, `maxbpm:`,
   * `tier:`), so a row only counts if it parses as a device config.
   */
  static list(): ControllerSummary[] {
    const out: ControllerSummary[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(STORAGE_PREFIX)) continue;
        const deviceId = key.slice(STORAGE_PREFIX.length);
        if (!deviceId || deviceId.includes(":")) continue;
        if (deviceId === "selectedDevice" || deviceId === "lessons-unlocked")
          continue;
        const c = Controller.load(deviceId);
        if (!c) continue;
        out.push({
          deviceId,
          name: c.name,
          kind: c.kind,
          profile: c.profile,
          padCount: c.pads.filter((p) => p.note != null).length,
          lastUsed: c.lastUsed,
        });
      }
    } catch {
      return out;
    }
    return out.sort((a, b) =>
      (b.lastUsed ?? "").localeCompare(a.lastUsed ?? ""),
    );
  }
}

// --- narrowing untrusted stored values --------------------------------------

function asPad(value: unknown): Pad {
  const v = (value ?? {}) as Record<string, unknown>;
  const sound = typeof v.sound === "number" ? v.sound : 38;
  return {
    id: typeof v.id === "string" ? v.id : "pad",
    label: typeof v.label === "string" ? v.label : "Pad",
    role: (typeof v.role === "string"
      ? v.role
      : roleForSound(sound)) as DrumRole,
    note: typeof v.note === "number" ? v.note : null,
    sound,
    ...(typeof v.altNote === "number" ? { altNote: v.altNote } : {}),
    ...(typeof v.altSound === "number" ? { altSound: v.altSound } : {}),
    ...(v.pedal === "kick" || v.pedal === "hihat" ? { pedal: v.pedal } : {}),
  };
}

function asHihat(value: unknown): HihatConfig {
  const v = (value ?? {}) as Record<string, unknown>;
  const mode =
    v.mode === "two-note" || v.mode === "stateful" || v.mode === "none"
      ? v.mode
      : "none";
  return {
    mode,
    pedal: asControl(v.pedal),
    closed: typeof v.closed === "number" ? v.closed : CLOSED_HAT,
    open: typeof v.open === "number" ? v.open : OPEN_HAT,
  };
}
