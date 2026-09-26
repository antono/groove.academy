# Proposal

## Why

A run can be started, paused and stopped from the controller, but it cannot be
**restarted** or **advanced** from it. Those are the two things a student does
most between attempts: a take goes wrong and they want it again from the top, or
it goes well and they want the next one. Both currently mean putting a stick
down and reaching for the screen — interrupting the one activity the app exists
to keep uninterrupted.

The controls already exist: Restart on the transport HUD, Next lesson on the
result screen. What is missing is a way to reach them without leaving the
instrument.

## What Changes

- Two gestures, each a pair of opposite corners struck together:
  - **again** — bottom-left with top-right
  - **next** — top-left with bottom-right
- Their meaning depends on where the student is, because "go on" means different
  things at different moments:

  | Where               | **again**          | **next**              |
  | ------------------- | ------------------ | --------------------- |
  | Resting lesson page | start the run      | —                     |
  | Result screen       | restart the lesson | go to the next lesson |
  | Quote interstitial  | advance, unrated   | advance, unrated      |
  | **During a run**    | **ignored**        | **ignored**           |

- **Gestures need the page to have audio**, which browsers grant only on a real
  click — a MIDI message is not user activation. So the first Play, Listen or
  on-screen tap of a visit brings up sound and MIDI together, and from then on
  the controller drives everything. On a page nothing has been clicked yet, no
  MIDI reaches the page at all and no gesture fires. This is the project's
  existing rule rather than a new one: a bound Start button is dead on a cold
  load for exactly the same reason.
- **Gestures do not exist during a run.** A run is the one moment where a stray
  chord costs something real — a good take thrown away — so it is the one moment
  the gesture is not recognised. This is what makes the rest of the design safe.
- **The same rule on every instrument**, kit or grid. An earlier draft bound them
  explicitly on kits, because a kit's corners are its kick and its ride and
  striking those together is ordinary drumming. Ignoring gestures during a run
  removes that failure entirely: the worst remaining case is a student noodling
  at rest and starting the lesson early, which Stop undoes. Explicit binding
  would also have cost two pads on a module whose panel transmits nothing.
- **Corners are declared, not inferred.** A grid computes them from its columns
  and rows. A kit profile states them, because where a drum sits is in the
  schematic and the Controller does not read SVG. A profile that declares none
  simply has no gestures.
- A chord needs a **time window**, which the Controller does not have: it
  deliberately does not debounce and reports one event per message. The window is
  generous — sized for a beginner landing two hands roughly together, not for a
  drummer's precision. It can afford to be, because a gesture cannot fire against
  anything being played for score.
- Pads are matched before transport, so the pads forming a gesture **still sound
  their drums**. A gesture is additional, never a mute.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `controller`: the facade gains corner-gesture recognition over a time window
  and reports the two new actions; the existing rule that a message is matched as
  a pad before it is matched as transport is unchanged and load-bearing here.
- `kit-profiles`: a profile may declare which of its pads are the four corners,
  since spatial position lives in the schematic rather than in the pad list.
- `quote-interstitial`: its rule that the interstitial advances "only after the
  user rates the quote or dismisses" gains the gesture as a third way out —
  advancing without recording a rating, because skipping past a quotation is not
  an opinion about it.

## Impact

- `src/lib/controller.svelte.ts` — chord recognition, corner resolution, two new
  `ControllerEvent` transport values.
- `src/lib/presets.ts` — an optional corner declaration on `KitProfile`, and the
  four corners of the NUX DP-2000.
- `src/routes/lessons/[id]/+page.svelte` — route the actions by where the page
  is, and ignore them outright during a run.
- `src/lib/quote-of-the-day.svelte` — advance unrated on a gesture.

### Out of scope

- Keyboard and touchscreen controllers. `virtual-controllers` specifies its own
  start/resume/stop, and extending it is a separate question.
- Any change to what Start and Stop already do, or to the transport binding
  stored per device — these gestures need no configuration.

### Risks

- **Noodling at rest could start a run**, on a kit whose corners are playable
  drums. Recoverable with Stop, and the alternative cost two of eight pads.
- **Trigger crosstalk could look like a chord.** A DP-2000 was observed emitting
  a second, softer note from a neighbouring pad five milliseconds after a strike.
  Opposite corners are the least likely pair to bleed into one another, but the
  window should not be so wide that a bleed and a real strike combine.
