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

The answer follows from how the model is **struck**, which is a property of the
instrument rather than of the student. Struck with sticks means two voices
however many pads it has, plus one for a bass pedal; struck with fingers means
every pad is independently reachable. That classification is looked up per
model, because how a device is drawn does not reliably say how it is played — a
stick-played multipad is not a kit schematic, and a sixteen-pad groove box is
not two voices.

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
- A catalogue of models classified as **stick-played** or **finger-played**,
  covering the common drum modules, multipads and pad grids — broader than the
  pad profiles, because the classification can be established from documentation
  while a pad's note cannot.
- A controller gains a **voice count** derived from that: two for a stick
  instrument plus one per scored pedal, its pad count for a finger instrument,
  and no limit where the model is unrecognised. Nothing stored, nothing
  migrated, nothing asked.
- The catalogue **marks** a lesson that exceeds the active instrument's voices, and
  says what would unlock it — "needs three limbs; a kick pedal would do it". It
  stays openable: the student, not the app, decides whether to try.
- `/lessons/[id]` states the same thing before a run, beside the existing
  missing-drum notice.

## Capabilities

### New Capabilities

None. The three existing capabilities below already own these surfaces.

### Modified Capabilities

- `controller`: gains a voice count, and its capability query gains a companion
  answer for how many hits at once.
- `lessons-catalogue`: the manifest requirement gains `voices`, and the lesson
  card gains the marker and its explanation.

## Impact

- `scripts/make-lessons.py` and `scripts/lessons/` — emit `voices` per lesson.
- `src/lib/stats.ts` / manifest consumers — read the new field.
- `src/lib/controller.svelte.ts` — the derived voice count and the query.
- `/lessons` cards and `/lessons/[id]` — the marker and the pre-run notice.

### Out of scope

- **Changing any lesson.** The three-voice lessons are correct as written; this
  change is about telling the truth to the student in front of them.
- **Hi-hat pedal as a voice.** Pedal traffic is control, not performance — it
  never scores, so it frees no hand.
- **A kit played with fingers.** Big-pad modules are stick instruments; a student
  who finger-drums one would need an override, which nothing yet asks for.
