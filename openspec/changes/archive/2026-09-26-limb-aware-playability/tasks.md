# Tasks

## 1. Lesson data

- [x] 1.1 Compute, per lesson, the largest number of scored hits on one instant
- [x] 1.2 Exclude the guide hi-hat, the count-in and the bass from that count
- [x] 1.3 Emit it into `static/lessons/manifest.json` from `make-lessons.py`
- [x] 1.4 Confirm the field is absent-tolerant on the reading side

## 2. Controller

- [x] 2.1 Classify models as stick- or finger-played, matched on the model name
- [x] 2.2 Derive a voice count from that classification, not from how it is drawn
- [x] 2.3 Count a scored pedal as a voice; do not count a control-only pedal
- [x] 2.4 Add the "can you strike N at once" query beside `canPlay` / `missing`
- [x] 2.5 Confirm no stored shape changes and nothing needs migrating
- [x] 2.6 Report no limit for an unrecognised model rather than guessing

## 3. Surfacing

- [x] 3.1 Mark an out-of-reach lesson on its catalogue card, distinctly from `planned`
- [x] 3.2 State what would unlock it
- [x] 3.3 Say the same on the resting lesson page, beside the missing-drum notice
- [x] 3.4 Keep every marked lesson openable and playable

## 4. Verification

- [x] 4.1 A two-voice kit marks exactly the 27 three-voice lessons
- [x] 4.2 A kit with a bass pedal clears all 27
- [x] 4.3 A pad grid marks none, at 4, 8 and 16 pads
- [x] 4.4 A config stored before this change reports a count without migration
- [x] 4.5 `pnpm check` clean after the surfacing work
- [x] 4.6 Classification spot-checked across 29 real device names
- [x] 4.7 See the marker in the running app on a real kit
