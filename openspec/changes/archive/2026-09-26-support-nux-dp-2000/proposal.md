# Proposal

## Why

The NUX DP-2000 cannot be set up correctly today. Its eight pads send notes that
sit inside the General MIDI percussion range but mean nothing in it: pad 5 sends
**50** ("High Tom") and the module plays a **kick**; pad 6 sends **45** ("Low
Tom") and plays a **snare**. `edrum-setup` adopts a captured GM-range note as the
pad's sound, so every pad on this kit ends up assigned the wrong drum — not
slightly off, but wrong on all eight. The student's only recourse is to re-map
each pad by hand after setup, and nothing tells them that is why the kit sounds
like nonsense.

The rule that produces this is reasoned, and its reasoning holds for the
Millenium MD-90 it was written against: a module that names its own pads in GM is
a better source than a profile written from a photograph. The DP-2000 is the
counterexample the rule did not anticipate — GM-_ranged_, not GM-_meaning_ — and
there is currently no way for a profile to say so.

Verified on hardware (port `NUX DP-2000 MIDI 1`, channel 10) against a
**factory-reset** unit, and read back from the module's own `MENU → MIDI NOTE`
screen, which agreed with the wire exactly:

| Pad           | 1   | 2   | 3   | 4    | 5        | 6         | 7              | 8            |
| ------------- | --- | --- | --- | ---- | -------- | --------- | -------------- | ------------ |
| Factory note  | 38  | 40  | 37  | 48   | 50       | 45        | 47             | 41           |
| Factory sound | tom | tom | tom | ride | **kick** | **snare** | **closed hat** | **open hat** |

The map is identical across kit 1 "Pop" and kit 2 "Studio", so it does not follow
the selected kit. These are reproducible properties of the model, and a shipped
profile can rely on them for a factory unit.

This map was read three times across two factory resets — once as the unit
arrived, then twice more after `MENU → RESET → RESET SYSTEM` — and was identical
every time. `RESET SYSTEM` is the scope that restores it: the kit-scoped resets
(`RESET CURRENT KIT`, `RESET ALL KIT`) leave `MIDI NOTE` untouched, because it is
a system setting rather than a kit parameter.

The NUX manual's own `MIDI NOTE` screenshot shows 36/38/40 for pads 1-3, which a
factory-reset unit contradicts. The manual is wrong there; the hardware is the
record.

They are not immutable: `MENU → MIDI NOTE` assigns a note per pad, so a student
who has edited theirs will differ, and any captured note must override the
shipped default.

## What Changes

- Ship a `nux-dp-2000` kit profile: 2×4 pad geometry, three toms, a ride, a kick,
  a snare, and closed and open hi-hats as **two distinct pads**. They are two
  separate physical pads here, not one hat sending two notes, so `altNote` does
  not apply and the pedals step — omitted for a geometry with no pedal pads — is
  not needed to discover them.
  Matched on the port name, never on its manufacturer string. Chrome reports this
  port's manufacturer as `Focusrite`, which is the manufacturer of an unrelated
  Scarlett Solo on the same machine — the kit's own USB vendor is NXP
  Semiconductors, and ALSA lists the two as separate cards. Chrome is pairing the
  port with the wrong card's manufacturer, so that half of `deviceIdentity()`
  varies with what else is plugged into the computer and SHALL NOT be matched on.
- Add `static/kits/nux-dp-2000.svg`: eight pads in two rows of four, with a
  `<g id>` per pad id, satisfying the 1:1 pad↔drum id contract
  `scripts/check-kits.py` enforces.
- A kit profile MAY carry the model's **factory-default** pad notes, verified
  against a factory-reset unit, so a recognised kit plays without a capture pass.
  They are defaults, not assertions: any captured note overrides them, because
  `MENU → MIDI NOTE` lets a student reassign any pad.
- A profile MAY declare that its notes are **not GM-meaningful**, which suppresses
  the capture-time GM adoption in `edrum-setup` for that model only. Behaviour for
  every other kit is unchanged.
- A factory DP-2000 is playable on first connect with no capture pass. Capture
  remains available and always wins, for a student who has edited their notes.

## Capabilities

### New Capabilities

None. This is covered by the two existing capabilities below; a new one would
duplicate them.

### Modified Capabilities

- `kit-profiles`: requirement 1 forbids a profile declaring any pad note, on the
  grounds that notes are reassignable from the module's front panel. That reason
  holds, but it does not follow that a _factory default_ is unknowable. R1 gains a
  narrow allowance: a profile MAY carry the model's factory-default notes,
  declared as defaults and overridden by any capture, so a student who has not
  touched `MENU → MIDI NOTE` plays immediately. A profile MAY also declare that
  its notes carry **no GM drum meaning** — a statement about the model, not about
  a student's instrument.
- `edrum-setup`: requirement 1's GM-adoption rule gains an exception — it SHALL
  NOT adopt a captured note as a pad's sound where the matched profile declares
  its notes are not GM-meaningful. The profile's suggested sound stands instead.

## Impact

- `src/lib/presets.ts` — `KitProfile` and `KitPad` types, the new profile entry.
- `src/lib/controller.svelte.ts` — `isDrumNote()` adoption becomes conditional on
  the profile; `Pad.note` / `altNote` seeded from a profile that ships them.
- `static/kits/nux-dp-2000.svg` — new first-party schematic.
- The wizard's kit path — a profiled kit that ships notes can reach the test step
  without capture.
- `scripts/check-kits.py` — no change expected; the new asset must satisfy it.

### Out of scope

- **No crash.** The factory kit puts no crash on any of the eight pads, so
  `canPlay()` will correctly report lessons needing 49 as unplayable. Not a
  defect of this change.
- **Trigger crosstalk.** A hit on pad 7 was observed emitting a second, softer
  note from pad 6 five milliseconds later. The Controller deliberately does not
  debounce, so this would score as an extra note. It is a module sensitivity
  setting, and a separate concern from mapping.
