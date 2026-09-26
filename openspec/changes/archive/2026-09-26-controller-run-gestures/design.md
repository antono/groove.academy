# Design

## Context

See proposal.md — Why.

Three existing facts constrain the approach:

- `Controller.handle()` returns **exactly one** `ControllerEvent` per message, and
  every caller is written as a switch over that one value.
- The Controller holds no timing state by design. It deliberately does not
  debounce: a 160 ms window would swallow 16ths at 120 BPM and quietly cost a
  roll.
- A profile's pads are an ordered list. Where a drum physically sits is in the
  schematic SVG, which only `controller-preview` reads.

The lesson page already distinguishes the three moments a gesture must mean
different things: `playing` is a run, `report` without `playing` is the result
screen, and neither is rest (`inSession = playing || !!report`).

## Goals / Non-Goals

**Goals.** A gesture reaches the page without breaking the one-event contract, and
without the Controller learning anything about lessons.

**Non-goals.** Debouncing. Changing what Start and Stop do. Any gesture on a
keyboard or touchscreen controller.

## Decisions

### The gesture rides on the hit, rather than replacing it

The spec requires that a pad forming a gesture still sounds its drum and is still
reported as a hit. Returning a separate `{ kind: "gesture" }` event would either
suppress the hit or require `handle()` to return two events — and every caller is
a switch over one.

So the second strike's `hit` event carries an optional `gesture` field. Existing
callers ignore an unknown field and keep working unchanged; the lesson page reads
it. The completing strike carries it, because that is the moment the gesture
becomes true.

This also keeps the "pads are matched before transport" ordering untouched, which
the spec calls load-bearing.

### Timing state is confined to the gesture, not the pads

The no-debounce rule is about _pads_, and it stays absolute: every hit is still
reported, at any rate, however fast. What the Controller gains is one small piece
of memory — the last corner struck and when — consulted only when the incoming
note is itself a corner. A roll on a corner pad still reports every hit; it may
also complete a gesture, which the caller is free to ignore, and during a run it
does.

### The window is one number, and it should be measured

Proposed default: **150 ms**. Bimanual asynchrony for an untrained player is
commonly well under 100 ms, so 150 ms clears a beginner comfortably while staying
far below a deliberate two-hit phrase.

It can afford to be generous precisely because gestures do not exist during a
run: the window never competes with anything being played for score. That is the
whole reason the earlier kit/grid split could be dropped.

Observed crosstalk on a DP-2000 put a phantom neighbouring note 5 ms after a
strike, which is inside any usable window — but crosstalk travels between
_adjacent_ pads, and a gesture is defined only across _opposite_ corners. The
pairing is what makes it safe, not the timing.

The number should be confirmed against a real kit before it is called settled; it
is a task, not a guess to leave in place.

### Corners are declared per profile, computed per grid

A grid knows its columns and rows, so its corners are arithmetic and need no
data. A kit does not: nothing in the pad list says which drum is bottom-left.

So `KitProfile` gains an optional corner declaration naming four of its own pad
ids. Partial declarations are treated as none — three corners describe no
diagonal, and a half-configured gesture that fires on one pair and not the other
would be worse than none.

`scripts/check-kits.py` already enforces that every pad id has a drum in the
schematic; it gains the matching check that every declared corner names a pad the
profile declares. Authoring checks belong where authoring happens.

### The page decides what a gesture means; the Controller does not

The Controller reports the gesture whenever it is performed. It knows what the
device did and nothing about what is on screen, which is the same line already
drawn for `hihatPreference`.

The lesson page routes on state it already has:

| Page state              | `again`         | `next`          |
| ----------------------- | --------------- | --------------- |
| `playing`               | ignored         | ignored         |
| `report`, quote showing | advance unrated | advance unrated |
| `report`, no quote      | restart         | next lesson     |
| at rest                 | start           | ignored         |

### The quote component probably needs no change

It already advances without a rating — that is what the "never show quotes"
checkbox does — and navigation is the parent's job; the component only signals
`onAdvance`. The parent holds the controller, so a gesture while the interstitial
is showing is handled where the gesture arrives. Expect the change here to be in
the lesson page, not in `quote-of-the-day.svelte`.

## Risks / Trade-offs

- **An optional field on `hit` is easy to miss.** A future caller wanting gestures
  must know to look. The alternative — a second event kind — breaks every
  existing switch, which is worse.
- **Noodling at rest can start a run** on a kit whose corners are playable drums.
  Accepted deliberately; Stop undoes it, and the alternative cost two pads on an
  eight-pad module whose panel transmits nothing.
- **Only profiles that declare corners get gestures.** The Millenium MD-90 has
  none until someone states them. Silent absence rather than a wrong guess, the
  same standard the factory notes are held to.
