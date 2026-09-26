# Design

## Context

The NUX DP-2000 is an eight-pad percussion unit, two rows of four, with the
control strip along the top and rear jacks (KICK, HH CTRL, TRIGGER IN) that are
empty on a bare unit. Everything below was measured on real hardware; the NUX
manual was found to be wrong on the one table that mattered.

| Pad           | 1   | 2   | 3   | 4    | 5    | 6     | 7          | 8        |
| ------------- | --- | --- | --- | ---- | ---- | ----- | ---------- | -------- |
| Sends note    | 38  | 40  | 37  | 48   | 50   | 45    | 47         | 41       |
| Module plays  | tom | tom | tom | ride | kick | snare | closed hat | open hat |
| App must play | 48  | 45  | 43  | 51   | 36   | 38    | 42         | 46       |

Read three times across two `RESET SYSTEM` resets, identical each time, and
identical across kits "Pop" and "Studio".

## Goals / Non-Goals

**Goals.** A DP-2000 is recognised from its port name and plays correctly with
no manual re-mapping. The fix generalises: any future module that names its pads
outside GM meaning is expressible without new special cases.

**Non-goals.** Crash support (no pad carries one). Trigger crosstalk (a module
sensitivity setting). Binding panel buttons to transport — the unit transmits
nothing from them. Widening transport control beyond start/stop.

## Decisions

### Why the GM-adoption rule needed an exception rather than a rewrite

`edrum-setup` adopts a captured GM-range note as the pad's sound, reasoning that
a module naming its own pads beats a profile written from a photograph. That
reasoning is sound and is load-bearing for the Millenium MD-90, whose toms were
guessed wrong in its profile until a real unit corrected them.

The DP-2000 breaks the rule's premise rather than its logic: it is GM-_ranged_
but not GM-_meaning_. Pad 5 sends 50 and plays a kick. Removing the rule would
regress the MD-90; leaving it makes this kit unusable. So the profile — the only
thing that knows which model this is — carries the declaration, and the rule
consults it.

The flag is named for the claim it makes (`gmNotes`), not for the kit that
needed it, and defaults to the existing behaviour so every other profile is
untouched.

### Why factory notes ship, when the spec forbade profile notes

`kit-profiles` R1 forbade profile notes because pads are reassignable from a
module's front panel. The DP-2000 confirms the premise — it has a
`MENU → MIDI NOTE` screen, and editing it survives a kit-scoped reset — so the
rule stays. What does not follow is that a _factory default_ is unknowable.

They are therefore defaults, not assertions: seeded at construction, replaced by
any captured note. A student on a factory unit plays immediately; a student who
has retuned their module captures as before and overrides them. The risk of a
wrong shipped note is bounded by the same capture path that already exists.

A note is declared only where measured. The alternative — guessing the pads we
had not read — would trade a visible "unmapped" state for an invisible wrong one.

### Why the hi-hat is two pads, not `altNote`

`Pad.altNote` exists for "one physical hat sending one note open and another
closed", so the schematic can light a single hi-hat. On this unit open and closed
are **two separate physical pads**. Modelling them as one would draw a picture
the student cannot match to the instrument in front of them.

It also avoids a dead end: the pedals step is omitted for a geometry with no
pedal pads, and that step is where a two-note hat is normally discovered. With
two pads each holding a fixed sound, there is nothing to discover — no pedal
state, no classification, and `hihatPreference` has no work to do.

### Why matching ignores the manufacturer

The identity string is name + manufacturer. Chrome reported this port's
manufacturer as `Focusrite` — the maker of an unrelated Scarlett Solo on the same
machine, while the kit's own USB vendor is NXP and ALSA lists them as separate
cards. That half of the identity varies with what else is plugged in, so the
pattern matches the name alone.

This is a latent hazard for `millenium-md-90`, whose pattern includes `medeli`,
a manufacturer term. Left alone deliberately: changing it is unrelated to this
change and wants its own verification against that hardware.

## Risks / Trade-offs

- **The factory notes come from one unit.** Mitigated by three readings across
  two resets, and by capture overriding them. If NUX ships different defaults in
  another firmware, a student captures and is unaffected.
- **The manual contradicts the hardware** (it shows 36/38/40 for pads 1-3). The
  measurement is recorded in the profile comment so the next reader does not
  "correct" the code to match the document.
- **`gmNotes` is a new axis on profiles.** Kept to one boolean with a safe
  default rather than a per-pad override, which nothing yet needs.
