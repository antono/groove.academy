# Design

## Context

Measured across the lesson MIDIs, counting only scored drum tracks (guide hat,
count-in and bass excluded):

| Simultaneous scored hits | Lessons |
| ------------------------ | ------- |
| 1                        | 18      |
| 2                        | 47      |
| 3                        | 27      |

Nothing exceeds three. The affected lessons are concentrated where you would
expect — `fill-with-kick`, `push-with-crash`, `one-drop`, `rock-anthem`, and the
stage 10-12 checkpoints — because that is where the curriculum starts asking for
a kick under a backbeat.

## Goals / Non-Goals

**Goals.** A student learns before a run, not during one, that a lesson asks for
more hands than they have. The answer is correct for a pad unit played with
fingers and for a kit played with sticks, which are the same hardware.

**Non-goals.** Changing any lesson. Scoring differently. Hiding anything.
Modelling which specific limb plays which drum.

## Decisions

### Why playing style is its own catalogue

`kind` is `grid` or `edrum`, and it answers "how is this drawn" — a grid of
cells, or a schematic. It correlates with how an instrument is played but is not
the same question, and the exceptions are common rather than exotic: a Roland
Octapad or SPD-SX is struck with sticks and has no kit schematic; an Akai MPC or
Ableton Push has sixteen or more pads and is played with fingers. Deriving reach
from `kind` would be right for the two profiles shipped today and wrong for much
of the market.

So playing style is looked up per model, in `STRUCK_BY`.

The evidence standard is what makes this safe, and it is worth stating because
it is the opposite of the rule this change sits next to. A pad's MIDI note can
only be established by measuring hardware — the NUX DP-2000 contradicts its own
manual. Whether an instrument is hit with sticks or fingers is a fact about its
physical size and purpose that a photograph settles. So the note catalogue grows
only when someone owns the unit, while the style catalogue can be extended from
documentation and is deliberately much broader.

Two defaults follow. An unrecognised model reports no limit: too high marks
nothing and leaves the student where they are today, while too low tells them a
lesson is beyond them when it is not. A **grid** is the one retained inference,
because a student picks that geometry precisely when their pads sit under one
hand.

The residual case is someone finger-drumming a big-pad module. They would be
marked when they need not be. Nothing yet asks for an override, and adding one is
cheap later; an earlier draft asked every student a wizard question to cover it,
which cost a step for an answer the model almost always gives.

### Why a pedal counts only when it scores

A bass pedal occupies a limb and produces a note, so it is a third voice. A
hi-hat pedal produces nothing — pedal traffic is control, not performance, and
never scores — so it frees no hand and adds nothing.

### Why a marker and not a block

`canPlay()` refuses nothing either; it states the problem and leaves Play
available. The precedent is right and the reasoning is stronger here: a missing
drum is impossible for anyone, whereas three voices is impossible only for how
this student is playing right now. They may put down a stick and use a hand.
They may want to try it anyway. The app should not decide that.

The marker must also be visually distinct from the greyed `planned` treatment. A
planned lesson does not exist; this one exists and is out of reach today. Reusing
the same grey would conflate "not written yet" with "not for your kit", which are
different disappointments.

### Why the generator emits the count

`make-lessons.py` writes the MIDI and the manifest from one set of patterns, so
a count emitted there cannot disagree with what the highway plays — the same
argument that keeps the catalogue schematic rendered from the lesson's own MIDI.
Computing it at parse time would also be correct, but every card would recompute
it, and the generator already knows which tracks are scored without having to
re-derive that from track names.

The count is stored as the number it is, not as a boolean "needs a pedal". Today
the threshold happens to be three; a lesson needing four should not require a
schema change to describe.

## Risks / Trade-offs

- **A new wizard step is friction** in a flow that already has up to seven. It
  sits with the pedals step, which is the other question about the student's
  body, and inherits its skip semantics rather than inventing new ones.
- **"Sticks or hands" is a simplification.** A student playing one stick and one
  hand is still two voices, so the simplification holds for the count even where
  it is crude as a description.
- **Marking depends on the active instrument.** With no instrument configured,
  nothing is marked, which is the same permissive default as an unstated count.
