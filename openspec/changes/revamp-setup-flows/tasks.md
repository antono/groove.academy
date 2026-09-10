Ordered to match [design.md](./design.md) — Migration Plan: extract shared chrome
while the single route still works, land the additive store and header, then the
fork and flows, and gate practice last.

There is no test runner in this project (`pnpm check` is `svelte-check` plus
`check-kits.py`), so verification is a type-check plus observable behaviour driven
in a real browser. Two harnesses make that practical without hardware:

- **Fake MIDI ports** — inject a stub `Navigator.prototype.requestMIDIAccess`
  returning a `Map` of fake inputs, each with an `onmidimessage` slot, plus a
  `window.__send(id, bytes)` helper. Lets every MIDI-flow task be verified with a
  recognised pad device, a recognised kit, and an unrecognised device.
- **No Web MIDI** — `delete Navigator.prototype.requestMIDIAccess` before load,
  to reproduce iOS Safari.

## 1. Shared chrome (no behaviour change)

- [ ] 1.1 Extract the wizard's step rail into a component taking the active flow's steps and the current step; verify every existing path renders an identical rail at 900px and 390px
- [ ] 1.2 Extract the card shell (header, subtitle, body, footer) used by every step; verify all ten current steps still render with `pnpm check` clean
- [ ] 1.3 Extract the capture loop (highlight, debounce, note recording, undo/skip/restart, progress) into one component driven by pads and a capture order; verify a fake 4×4 grid and the fake Medeli kit both still map end to end
- [ ] 1.4 Fix the `captureIndex` / `padIndex` divergence so the capture step reads the highlighted pad through `captureOrder`; verify with a fake kit whose pedal pad is **not** last that the named drum, the highlighted drum and the target of a label edit are the same pad

## 2. Active instrument as one authority

- [ ] 2.1 Add the active-instrument state and setter alongside `Controller`, persisting to `selectedDevice`, with the resolution order session → persisted → none; verify in the console that setting it persists across a reload and that a persisted id whose config was deleted resolves to none
- [ ] 2.2 Add the "is anything configured" query, counting only instruments with at least one mapped pad; verify it reports false on a cleared `localStorage`, false for a stored config with no notes, and true after completing any flow
- [ ] 2.3 Point `/lessons/[id]` at the shared state, removing its own `onMount` `(coarse ? touch : keyboard)` default and making its input chooser a view of the store; verify selecting an input there and reloading keeps that input, and that no input is auto-selected when nothing is configured

## 3. Header instrument chip and switcher

- [ ] 3.1 Add the header chip naming the active instrument, hidden when nothing is configured; verify it is absent on a cleared `localStorage` and names the instrument after a flow completes
- [ ] 3.2 Distinguish connected from configured-but-absent, treating virtual sources as always present; verify with fake MIDI that removing the port from the fake input map and firing `onstatechange` flips the chip to not-connected without a reload
- [ ] 3.3 Add the dropdown listing configured instruments plus "set up another", switching the active instrument without a reload; verify switching from the header changes which mapping an open lesson page interprets hits with
- [ ] 3.4 Refuse an instrument switch while a scored run is in progress; verify the chip cannot change the active instrument mid-run
- [ ] 3.5 Make the chip fit the collapsed header at 320px, degrading to a compact form that keeps its connected state and exposes the full name to assistive technology; verify at 320px that the header stays one row, the page does not scroll horizontally, and the tap target meets the minimum size

## 4. The fork

- [ ] 4.1 Add `/onboarding` as the fork screen offering keyboard, touchscreen and MIDI, with `/onboarding/keyboard`, `/onboarding/touch` and `/onboarding/midi` as the flow routes; verify each flow route enters its flow directly and that every existing link into `/onboarding` still lands on the fork
- [ ] 4.2 Add the synchronous capability probe — `typeof navigator.requestMIDIAccess` and `matchMedia('(pointer: coarse)')` — ordering and annotating the three cards without disabling or hiding any; verify with Web MIDI deleted that the leading card is one that works, that the MIDI card still selects, and that no disabled control is the most prominent element
- [ ] 4.3 Confirm the fork never calls `requestMIDIAccess()`; verify by loading the fork with a `requestMIDIAccess` stub that never resolves and checking the cards are still selectable
- [ ] 4.4 Make the rail show nothing flow-specific on the fork and derive from the chosen flow thereafter; verify the first screen no longer promises five steps and that each flow's rail step count equals the screens actually walked
- [ ] 4.5 Add the three flow routes to `offline-set.ts`; verify `pnpm build && pnpm preview` serves each flow route offline

## 5. The MIDI flow

- [ ] 5.1 Replace the `grid` / `edrum` / `known` / `virtual` `Path` union with one MIDI flow plus an already-configured entry condition, removing the `path === 'known'` branches in `finishTest()` and the pedals and transport Back targets; verify `pnpm check` is clean and no `path ===` comparison remains
- [ ] 5.2 Add the geometry step offering schematic, grid and neutral as a picture-choice, pre-selected from `matchDevice()` but never decided by it; verify the fake Medeli kit pre-selects its schematic, the fake MPD218 pre-selects a 4×4 grid, and the fake unrecognised device pre-selects nothing while offering all three
- [ ] 5.3 Make Skip and early-Done available for every geometry; verify a fake 4×4 grid can be finished after mapping 3 pads and that a skipped pad is left unmapped rather than placeheld
- [ ] 5.4 Replace `playScaleTone` in capture with the mapped drum, and drop the `isKit` guard on `adoptGmSound`; verify a grid capture sounds drums and that capturing note 38 on a grid pad sets that pad's sound to 38
- [ ] 5.5 Show the pedals step only when the chosen geometry has a pedal pad, leaving `classifyHihat()` and `pedalMessage()` logic untouched; verify the fake kit still classifies two-note, stateful and none correctly, and that a grid geometry skips the step entirely
- [ ] 5.6 Add try-it as the MIDI flow's terminal step for every geometry, naming and sounding the struck pad's drum and reporting unmapped notes; verify an unmapped note is reported rather than ignored, and that returning to capture from try-it keeps what was already correct
- [ ] 5.7 Enter the flow at try-it when the chosen port is already configured with at least one mapped pad, and keep re-map available there; verify a second run through the flow for the same fake device skips geometry and capture, and that a config with no notes does not
- [ ] 5.8 Preserve sounds, labels, geometry and hi-hat classification across a re-map, and warn that changing geometry discards the mapping; verify a two-note hi-hat classification survives a re-map and that confirming a geometry change restarts capture

## 6. The keyboard and touch flows

- [ ] 6.1 Give each virtual source its own flow reaching a playable instrument with no mapping step required; verify choosing either from the fork produces a configured, immediately playable instrument
- [ ] 6.2 Add try-it to both flows exercising the real input surface — `virtual-pads.svelte` for touch, live `keydown` for keyboard; verify a tap on touch try-it and a mapped key on keyboard try-it behave as they do in a lesson
- [ ] 6.3 Make the mapping editor an optional step reached from try-it, stating each pad's drum once with the assign and audition controls visually distinct; verify the doubled drum name is gone and that an edit persists across a reload
- [ ] 6.4 State the transport keys in the keyboard flow and make them work on try-it; verify Space and Escape act on try-it as they do during a run
- [ ] 6.5 List the keyboard and on-screen pads in the MIDI flow's port list, entering their flow when chosen; verify both appear alongside the fake MIDI ports and that choosing one leaves the MIDI flow
- [ ] 6.6 Enter a virtual flow at try-it when that source's mapping has already been edited; verify a second visit lands on try-it rather than the editor

## 7. The gate

- [ ] 7.1 Route a lesson opened with nothing configured to the fork; verify with cleared `localStorage` that `/lessons/1.1` lands on the fork and that completing the keyboard choice returns a playable lesson
- [ ] 7.2 Fire the gate only when nothing at all is configured; verify a machine with a configured MIDI instrument opens the lesson even with the fake port removed from the input map
- [ ] 7.3 Confirm the gate is one choice deep; verify the click count from a gated lesson to a playable instrument is one for both keyboard and touch

## 8. Verification across the change

- [ ] 8.1 Walk all three flows at 390px and 320px with a screenshot per step; verify no rail label overlaps another label or a marker, and no page scrolls horizontally
- [ ] 8.2 Walk the MIDI flow against all three fake devices plus the no-Web-MIDI case; verify no flow can reach a state whose only exits are Restart and Back
- [ ] 8.3 Give the rail list semantics and mark the current step for assistive technology; verify the accessibility tree exposes the rail as a list with the current step marked, rather than as bare text
- [ ] 8.4 Confirm no stored configuration was migrated or rewritten; verify a config saved by the pre-change wizard still loads, plays and reports the same pad count after the change
- [ ] 8.5 Run `pnpm check` and `pnpm build`; verify both pass
