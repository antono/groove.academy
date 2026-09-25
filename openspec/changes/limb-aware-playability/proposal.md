# Proposal

## Why

Twenty-seven of the ninety-two lessons require **three scored hits at the same
instant** — a kick, a snare and a hat landing together. A student playing a drum
kit with two sticks and no pedal has two voices, so those lessons cannot be
played at all. Nothing says so. They open, they run, and a third of every bar
scores as a miss the student had no way to hit.

`canPlay()` already refuses a lesson whose drums the instrument cannot sound. This
is the same promise — _tell the student before the run, not during it_ — for the
other half of the question: not whether the kit has the drum, but whether the
student has a limb free to strike it.

The trap is that this is **not** a property of the device. A NUX DP-2000 has eight
pads; played with sticks it is two voices, played with fingers it is eight. The
curriculum is written for finger drumming and the instrument is deliberately not
assumed, so deriving the answer from "it is a drum kit" would lock a
finger-drummer out of a third of the curriculum on the strength of a guess.

Measured across the lesson MIDIs (scored drum tracks only — guide hat, count-in
and bass excluded):

| Simultaneous scored hits | Lessons |
| ------------------------ | ------- |
| 1                        | 18      |
| 2                        | 47      |
| 3                        | 27      |

Nothing needs more than three, so this is a single threshold rather than a scale.

## What Changes

- The lesson manifest gains a per-lesson **`voices`** count: the largest number of
  scored hits that land on one instant. Derived by the generator from the same
  pattern data the MIDI is written from, so it cannot drift from what the highway
  plays.
- A controller gains a stated **voice count** — how many hits its student can
  strike at once — persisted with the instrument.
- The MIDI kit flow asks for it: **sticks, or hands?** Pedals are already known, so
  the answer plus the kit's pedal pads gives the total. Skippable, with a
  permissive default, because a wrong small number is worse than no number.
- A grid, keyboard or touchscreen is not asked; those are finger-played by
  definition and answer with their pad count.
- The catalogue **marks** a lesson that exceeds the active instrument's voices, and
  says what would unlock it — "needs three limbs; a kick pedal would do it". It
  stays openable: the student, not the app, decides whether to try.
- `/lessons/[id]` states the same thing before a run, beside the existing
  missing-drum notice.

## Capabilities

### New Capabilities

None. The three existing capabilities below already own these surfaces.

### Modified Capabilities

- `controller`: the requirement that a controller carries and persists its
  identity gains the stated voice count; the requirement that it can say which GM
  notes it can produce gains a companion answer for how many at once.
- `edrum-setup`: the MIDI kit flow gains the sticks-or-hands question, with the
  same skippability the pedals step has.
- `lessons-catalogue`: the manifest requirement gains `voices`, and the lesson
  card gains the marker and its explanation.

## Impact

- `scripts/make-lessons.py` and `scripts/lessons/` — emit `voices` per lesson.
- `src/lib/stats.ts` / manifest consumers — read the new field.
- `src/lib/controller.svelte.ts` — stated voice count, persistence, the query.
- `src/lib/setup/midi-flow.svelte` — the new question.
- `/lessons` cards and `/lessons/[id]` — the marker and the pre-run notice.

### Out of scope

- **Changing any lesson.** The three-voice lessons are correct as written; this
  change is about telling the truth to the student in front of them.
- **Hi-hat pedal as a voice.** Pedal traffic is control, not performance — it
  never scores, so it frees no hand.
