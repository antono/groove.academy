// Which instrument the student is playing on right now — one answer, read by
// everyone.
//
// Before this, `groove-master:selectedDevice` had four independent interpreters:
// the lesson page (which also chose a default on mount), `Controller.save()`,
// `savedKit()` in config.ts, and the debug pages. The header chip and the gate on
// practice make that untenable — they have to agree with the lesson page about
// what is active and whether anything is configured at all.
//
// Exposed as one object with getters rather than exported `$derived` constants:
// an exported const is read once at import and would hand every consumer a
// snapshot. Same shape as MidiHub, for the same reason.
//
// Device-local by design. Which instrument is in front of the student is a
// property of the machine, not of their account, so this is never synced.

import { Controller, type ControllerSummary } from "$lib/controller.svelte";
import { STORAGE_PREFIX } from "$lib/config";
import { VIRTUAL_INPUTS } from "$lib/virtual-input";

const KEY = STORAGE_PREFIX + "selectedDevice";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // private mode: the session still plays, it just isn't remembered
  }
}

class ActiveInstrument {
  /** This session's choice. `null` means nothing chosen yet in this session. */
  #chosen = $state<string | null>(null);

  /**
   * Bumped whenever stored configuration changes, so the getters below recompute.
   * localStorage is not reactive, and a flow that has just saved an instrument
   * must reach the header without a reload.
   */
  #revision = $state(0);

  /**
   * Whether a scored run is under way. The instrument must not change underneath
   * one, and the control that would change it — the header chip — does not live
   * in the page that knows a run is happening. A paused run still counts: it has
   * not ended and its scoring is still open.
   */
  #running = $state(false);

  /**
   * Ports enumerated by whichever surface already holds MIDI access, or null when
   * nobody does. Null means "we have not been told", NOT "nothing is plugged in" —
   * the difference is what lets the header chip avoid claiming a disconnection it
   * cannot know about, and avoid requesting access to find out.
   */
  #ports = $state<string[] | null>(null);

  get ports(): string[] | null {
    return this.#ports;
  }

  /** Called by a surface that holds MIDI access; pass null when it gives it up. */
  setPorts(ids: string[] | null) {
    this.#ports = ids;
  }

  /** Call after writing or deleting a stored controller. */
  changed() {
    this.#revision++;
  }

  /**
   * Configured instruments: hardware with at least one mapped pad, plus virtual
   * sources that have been stored.
   *
   * A virtual source counts once *stored*, never before. Pad count cannot decide
   * it — `Controller.virtual` gives every pristine pad a synthetic note, so a
   * default is indistinguishable from an edit by count alone. And
   * `Controller.list()` skips ids containing ":" so a virtual source is not
   * double-listed in a device chooser, which is why it is asked about separately.
   */
  /**
   * Cached against the revision. `Controller.list()` walks every localStorage key
   * and JSON-parses the ones that look like a device, and this getter is read
   * several times per render by the chip alone — re-scanning each time was a
   * visible delay on navigation.
   */
  #cache: { rev: number; list: ControllerSummary[] } | null = null;

  get all(): ControllerSummary[] {
    const rev = this.#revision;
    if (this.#cache && this.#cache.rev === rev) return this.#cache.list;
    const out = Controller.list().filter((s) => s.padCount > 0);
    for (const v of VIRTUAL_INPUTS) {
      if (read(STORAGE_PREFIX + v.id) == null) continue;
      const c = Controller.load(v.id);
      if (!c) continue;
      out.push({
        deviceId: v.id,
        name: c.name,
        kind: c.kind,
        profile: c.profile,
        padCount: c.pads.length,
        lastUsed: c.lastUsed,
      });
    }
    out.sort((a, b) => (b.lastUsed ?? "").localeCompare(a.lastUsed ?? ""));
    this.#cache = { rev, list: out };
    return out;
  }

  /**
   * Is anything set up at all? This gates practice, so it must not depend on MIDI
   * permission having resolved — a configured student on a browser with no Web
   * MIDI must still read as configured.
   */
  get anyConfigured(): boolean {
    return this.all.length > 0;
  }

  /**
   * This session's choice, then the persisted one, then none. A persisted id
   * whose configuration has gone resolves to none rather than to a missing
   * instrument.
   */
  get id(): string | null {
    const list = this.all;
    const chosen = this.#chosen;
    if (chosen && list.some((s) => s.deviceId === chosen)) return chosen;
    const saved = read(KEY);
    if (saved && list.some((s) => s.deviceId === saved)) return saved;
    return null;
  }

  get summary(): ControllerSummary | null {
    const id = this.id;
    return id ? (this.all.find((s) => s.deviceId === id) ?? null) : null;
  }

  /**
   * Make an instrument active, and remember it for next time.
   *
   * **Writes only — it must never read reactive state.** The lesson page calls this
   * from the effect that owns the MIDI port, so anything read here becomes a
   * dependency of an effect that also writes it, and the update depth is exceeded
   * on the first hydration: the page renders nothing at all. That rules out
   * `#revision++`, which is a read as well as a write, and equally rules out an
   * `if (this.#chosen === deviceId) return` guard. A plain assignment is safe —
   * `$state` does not notify when the value is unchanged — and choosing an
   * instrument does not change *which instruments exist*, so there is nothing for
   * the revision to say.
   */
  set(deviceId: string | null) {
    this.#chosen = deviceId;
    try {
      if (deviceId) localStorage.setItem(KEY, deviceId);
      else localStorage.removeItem(KEY);
    } catch {
      /* private mode */
    }
  }

  get runInProgress(): boolean {
    return this.#running;
  }

  setRunInProgress(value: boolean) {
    this.#running = value;
  }
}

export const activeInstrument = new ActiveInstrument();
