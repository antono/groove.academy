## Why

The setup wizard guesses what instrument a student has instead of asking, and it
guesses badly. `matchDevice()` decides between "pad grid" and "drum kit" from a
regex on a USB port string, and exactly one kit profile ships — so nearly every
real electronic kit lands on a screen titled **"Pad layout"** with a 4×4 grid
drawn on it, and the way out is a text link below the fold. Nobody is ever asked
what they are playing on, which is the one question the wizard exists to answer.

Two more problems follow from the same root. A browser with no Web MIDI — every
iPhone and iPad — gets a page headed "Connect your pads" whose largest element is
a disabled `Connect USB / MIDI` button, with the only working options demoted
beneath the words "No controller?". And the pad-grid path is a dead end: `Skip`
and the early `Done →` are both gated on `isKit`, so a grid student who cannot
land all sixteen note-ons cannot advance at all, having heard sixteen A-minor
piano tones and not one drum.

Meanwhile the wizard is not on the critical path for the students who need it
least: `/lessons/[id]` already auto-selects `(pointer: coarse) ? touch : keyboard`
and plays with no setup whatsoever, so a keyboard student is sold a wizard they
can skip while a kit student is misrouted by one they cannot.

## What Changes

- **The fork is asked, not guessed.** A new first screen asks what the student is
  playing on and offers three flows: **keyboard**, **touchscreen**, **MIDI**.
  Device detection is demoted to pre-selecting an answer, never deciding one.
- **Three flows, not four — pad grid becomes a geometry, not a path.** A grid of
  pads is a MIDI instrument whose pads have no picture. The MIDI flow is single,
  and _geometry_ (a shipped kit schematic, an `N×M` grid, or the neutral
  arrangement) is a property chosen inside it. This retires the `grid` / `edrum`
  path split and the conditionals that trail it.
- **Every flow ends in the same "try it" step.** Today only the drum path proves
  its mapping; the grid path goes `map → transport → done` and the virtual path
  has no test at all. Try-it becomes the one screen all three share — and the one
  a student can jump straight to when their instrument is already configured.
- **The dead end goes.** Skip and early-Done stop being kit-only, so an
  incompletely-mapped MIDI instrument is always finishable, and capture auditions
  the **drum** rather than `playScaleTone`.
- **Flows are offered by capability.** No Web MIDI means the MIDI flow is not the
  headline; no touch means the touchscreen flow is not offered first. The
  `(pointer: coarse)` and `navigator.requestMIDIAccess` checks the lesson page
  already makes are made here too, and a disabled primary CTA never leads a page.
- **Setup gates practice.** With no instrument configured, entering a lesson
  routes to the fork instead of silently defaulting. Setup becomes the front door
  it already claims to be on the homepage.
- **The active instrument moves into the header.** Once at least one instrument is
  configured, the top bar shows it as connected beside the existing icons, and
  opens a dropdown to switch between configured instruments. The active choice
  becomes global state the header owns rather than a `selectedDevice` string the
  lesson page reads on mount.
- **Each flow is addressable.** `/onboarding/keyboard`, `/onboarding/touch`,
  `/onboarding/midi` — so a flow can be linked, resumed and returned to, and so
  the 2,233-line single component splits along the seams it already has.
- **BREAKING** (internal): the `Path` union `grid | edrum | known | virtual` is
  replaced. `known` stops being a path and becomes an _entry condition_ on each
  flow, removing the `path === 'known'` special cases in `finishTest()` and the
  pedals and transport Back targets.

## Capabilities

### New Capabilities

- `setup-flows`: The fork screen and the three-flow structure that replaces the
  guessed path split — how a flow is chosen, offered by device capability,
  addressed by route, entered when already configured, and how every flow reaches
  a shared try-it step. Owns the requirement that setup gates practice, and the
  step rail's honesty (it may only show the steps of a flow actually chosen).
- `instrument-switcher`: The header's connected-instrument indicator and its
  dropdown for switching between configured instruments, plus what "the active
  instrument" means as observable global state.

### Modified Capabilities

- `edrum-setup`: Becomes the single **MIDI flow** rather than "the wizard's second
  path". Geometry becomes a property chosen within the flow instead of a fork
  before it; the grid geometry gains the Skip, early-Done and try-it steps it
  lacks today; capture auditions the mapped drum rather than a scale tone; the
  "set it up as a kit" footnote is removed because the question is asked up front.
- `virtual-controllers`: The keyboard and the on-screen pads become two distinct
  flows with a try-it step each, offered by input capability rather than under a
  "No controller?" apology. Their mapping editor becomes optional rather than the
  whole flow, and virtual sources appear in the wizard's own source list — which
  the spec already requires and the device step does not do.
- `controller`: The active instrument becomes first-class persisted state with a
  defined resolution order and an "is anything configured?" query, so the header
  and the gate read one source instead of each interpreting `selectedDevice`.
- `responsive-layout`: The step rail must stay legible at phone width — it
  currently overlaps its own labels at 390px — and the header's instrument chip
  must fit alongside the collapsed navigation control without wrapping the header.

## Impact

- `src/routes/onboarding/+page.svelte` (2,233 lines) splits into a fork screen
  plus per-flow routes; `Step` and `Path` unions and `PATHS` are replaced.
- `src/lib/presets.ts` — `matchDevice()` becomes a suggestion for the geometry
  step rather than the router; `MAX_COLS` / `MAX_ROWS` gain a review.
- `src/lib/controller.svelte.ts` — active-instrument selection and an
  "anything configured" query; `Controller.list()` gains the switcher as a caller.
- `src/routes/+layout.svelte` — the header gains the instrument chip and dropdown.
- `src/routes/lessons/[id]/+page.svelte` — its own on-mount input auto-selection
  and chooser defer to the shared active instrument; it gains the gate.
- `src/lib/virtual-input.ts` — capability probing for which sources to offer.
- Latent bug to fix in passing: the map step reads
  `controller.pads[captureIndex]` where every other read goes through
  `padIndex = captureOrder[captureIndex]`, so a profile whose pedal pad is not
  last would name one drum and edit another.
- No data migration: controllers are already stored per `deviceId`, and a stored
  config with no `kind` is still read as a pad grid.
