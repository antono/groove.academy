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

Two measured traps to respect when verifying:

- **Resizing the window cannot reach phone widths.** Chrome clamps its window to a
  ~500px CSS viewport, so a "390px" resize silently measures 500px. Use device
  metrics emulation (`390x780x2,mobile,touch`) and assert `window.innerWidth`
  before trusting any width-dependent result.
- **Note-ons are filtered twice.** Messages shorter than 3 bytes, non-`0x90`, or
  zero-velocity are dropped before listeners see them, and the capture debounce
  swallows a repeat of the same note inside 160 ms. Space same-note sends further
  apart or captures silently no-op. Measured: 180 ms between sends lost one capture;
  220 ms was reliable.

## 1. Shared chrome (no behaviour change)

- [x] 1.1 Extract the wizard's step rail into `$lib/wizard-rail.svelte` taking `steps`/`stepIndex`, with `aria-current="step"` on the active item, explicit `role="list"`/`"listitem"` (the rail's own `display: flex` strips the implicit list role in Chrome), label truncation, and the labels-collapse threshold as one named constant. Root cause of the collision was not width but `.rail-step { flex: 1 }` forcing equal shares — `Map pads` truncated while `Grid` sat in slack, at widths where the labels fit with 21px to spare; now `flex: 1 1 auto`. Added a 640px collapse so a five-step rail names only the current step when its labels stop fitting, rather than surviving as ellipsised stubs. Verified: 900px and 641px all five labels full, untruncated, no collisions; 500px only the active label (collisions were `Connect`x2 and `Map pads`x5, now none); 390px and 320px labels hidden, rail 280/280, no page scroll; 7-step rail collapses as before; `aria-current` present at every width; `pnpm check` clean at 311 files.
- [x] 1.2 Extract the card shell into `$lib/wizard-card.svelte` — `title` string, `subtitle`/`badge`/`foot`/`children` snippets, `align` for the closing step — and move `.card`, its `@media` padding, `.card-head`, `.card-head.center` (was `.done-head`), `.sub` and `.card-foot` with it. Each step now renders its own card, so the shared `<section>` is gone and a step matching nothing renders nothing rather than an empty bordered panel. `subtitle` is a snippet, not a string: six of the ten carry markup. The analytics `$effect` and shared `onMount` were left untouched per design.md decision 7. Two traps hit and fixed: snippets compile to functions, so TypeScript loses the branch guard's narrowing of a mutable `let` (hoisted `{@const c = controller}`); and a `{@const}` left among the children is scoped to that snippet, so `subtitle`/`foot` could not see it — `ReferenceError: g is not defined` until `g` and `current` were hoisted above the card. Verified: all ten cards walked under the fake-MIDI harness (connect correctly has no footer; `done` centres, shows its badge and keeps its inverted `[btn-group, cta]` footer; the keyboard step's subtitle still renders both `<kbd>`s; the capture subtitle still renders `<strong class="count">`). A/B against HEAD on the `done` footer is pixel-identical — height 136px, buttons 127/87/88/69/94 wide at 64 high — so its pre-existing button wrapping is unchanged, not a regression. `pnpm check` clean at 312 files, 0 warnings.
- [ ] 1.3 Extract the capture loop (highlight, debounce, note recording, undo/skip/restart, progress) into one component driven by pads and a capture order, moving the debounce state wholesale and giving `pedalNote` its own copy, and exposing an `oncomplete` callback instead of tail-calling `finish()`; verify a fake 4×4 grid and the fake Medeli kit both map end to end, and that a pedal gesture reusing the last captured pad's note is still registered rather than swallowed as a bounce
- [x] 1.4 Fix the `captureIndex` / `padIndex` divergence so the capture step reads the highlighted pad through `captureOrder`; verified by walking the Medeli kit (named drum matches the newly-lit drum at every step, counter `1/7` confirming the pedal is excluded). The divergent ordering is unreachable in the shipped app — one profile, pedal last, and `buildCustomPads` sets no pedal — which is why it was latent; `current`, the preview's `captureIndex` and both editors now read the one index by construction. Re-verify against a real divergent profile when 5.2 makes pedal roles assignable.

## 2. Active instrument as one authority

- [ ] 2.1 Add the active-instrument state and setter alongside `Controller`, persisting to `selectedDevice`, with the resolution order session → persisted → none; verify in the console that setting it persists across a reload and that a persisted id whose config was deleted resolves to none
- [ ] 2.2 Add the "is anything configured" query — a mapped pad for hardware, a stored mapping for a virtual source, covering the reserved `:` ids the registry skips; verify it reports false on a cleared `localStorage`, false for a stored config with no notes, false for a virtual source never set up, and true immediately after completing a virtual flow (which requires 6.1's explicit save, so land them together)
- [ ] 2.3 Point `/lessons/[id]` at the shared state, removing its own `onMount` `(coarse ? touch : keyboard)` default and making its input chooser a view of the store; verify selecting an input there and reloading keeps that input, and that no input is auto-selected when nothing is configured

## 3. Header instrument chip and switcher

- [ ] 3.1 Add the header chip naming the active instrument, hidden when nothing is configured; verify it is absent on a cleared `localStorage` and names the instrument after a flow completes
- [ ] 3.2 Give the chip three states — present, absent, and unknown — reporting presence only from access another surface already holds and never requesting access itself, and treating virtual sources as always present; verify on a **lesson page** (which holds access) that `__unplug` plus `onstatechange` flips it to not-connected without a reload, that on the fork it reads "configured" with no permission prompt, and that virtual sources always read present
- [ ] 3.3 Add the dropdown listing configured instruments plus "set up another", switching the active instrument without a reload; verify switching from the header changes which mapping an open lesson page interprets hits with
- [ ] 3.4 Add run-in-progress state to the shared store, set when a scored run starts and cleared when it ends, is abandoned or its page is left, with a paused run still counting, and refuse an instrument switch while it is set; verify the chip cannot change the active instrument mid-run or while paused, and that it can again after the result screen
- [ ] 3.5 Make the chip fit the collapsed header at 320px, degrading to a compact form that keeps its connected state and exposes the full name to assistive technology; verify at 320px that the header stays one row, the page does not scroll horizontally, and the tap target meets the minimum size

## 4. The fork

- [ ] 4.1 Add `/onboarding` as the fork screen offering keyboard, touchscreen and MIDI, with `/onboarding/keyboard`, `/onboarding/touch` and `/onboarding/midi` as the flow routes; verify each flow route enters its flow directly and that every existing link into `/onboarding` still lands on the fork
- [ ] 4.2 Add the synchronous capability probe — `typeof navigator.requestMIDIAccess` and `matchMedia('(pointer: coarse)')` — ordering and annotating the three cards without disabling or hiding any; verify with Web MIDI deleted that the leading card is one that works, that the MIDI card still selects, and that no disabled control is the most prominent element
- [ ] 4.3 Confirm the fork never calls `requestMIDIAccess()`; verify by loading the fork with a `requestMIDIAccess` stub that never resolves and checking the cards are still selectable
- [ ] 4.4 Make the rail show nothing flow-specific on the fork and derive from the chosen flow thereafter; verify the first screen no longer promises five steps and that each flow's rail step count equals the screens actually walked
- [ ] 4.5 Add the three flow routes to `offline-set.ts`; verify by `pnpm build && pnpm preview`, then calling `warmOfflineSet()` from the console (build+preview alone never fetches the offline set — it fires on install or the standalone heuristic), confirming the three exact paths are in the versioned cache, then going offline and navigating to each

## 5. The MIDI flow

- [ ] 5.1 Replace the `grid` / `edrum` / `known` / `virtual` `Path` union with one MIDI flow plus an already-configured entry condition, removing the `path === 'known'` branches in `finishTest()` and the pedals and transport Back targets; verify `pnpm check` is clean and no `path ===` comparison remains
- [ ] 5.2 Add the geometry step offering schematic, grid and neutral as a picture-choice at a matched size (pass an explicit preview size — capture mode resolves to `lg`, for which the kit renderer has no rule), pre-selected from `matchDevice()` but never decided by it, persisting the choice as an additive optional field, and defining the winner when a device matches both a kit profile and a grid preset; verify the fake Medeli kit pre-selects its schematic, the fake MPD218 a 4×4 grid, the fake unrecognised device nothing while still offering every choice, and that a grid chosen for the Medeli kit loads back as a grid
- [ ] 5.3 Make Skip and early-Done available for every geometry; verify a fake 4×4 grid can be finished after mapping 3 pads and that a skipped pad is left unmapped rather than placeheld
- [ ] 5.4 Replace `playScaleTone` in capture with the mapped drum, and drop the `isKit` guard on `adoptGmSound`; verify a grid capture sounds drums, that capturing note 38 on a grid pad sets that pad's sound to 38, and that an out-of-range note (137) leaves the suggested sound alone
- [ ] 5.5 Show the pedals step only when the chosen geometry has a pedal pad, leaving `classifyHihat()` and `pedalMessage()` logic untouched; verify the fake kit still classifies two-note, stateful and none correctly, that a grid geometry skips the step, and that a **neutral** geometry with a pad assigned a pedal role still reaches it — neutral pads carry no pedal flag today, so bass capture would otherwise be silently lost
- [ ] 5.6 Add try-it as the MIDI flow's terminal step for every geometry, naming and sounding the struck pad's drum and reporting unmapped notes; verify an unmapped note is reported rather than ignored, and that returning to capture from try-it keeps what was already correct
- [ ] 5.7 Enter the flow at try-it when the chosen port is already configured with at least one mapped pad, and keep re-map available there; verify a second run through the flow for the same fake device skips geometry and capture, and that a config with no notes does not
- [ ] 5.8 Preserve sounds, labels, geometry and hi-hat classification across a re-map, and warn that changing geometry discards the mapping; verify a two-note hi-hat classification survives a re-map and that confirming a geometry change restarts capture

## 6. The keyboard and touch flows

- [ ] 6.1 Give each virtual source its own flow reaching a playable instrument with no mapping step required, calling `save()` on completion even when nothing was edited; verify choosing either from the fork produces an instrument that `configuredAny()` reports as configured and that plays immediately
- [ ] 6.2 Add try-it to both flows exercising the real input surface — `virtual-pads.svelte` for touch, live `keydown` for keyboard; verify a tap on touch try-it and a mapped key on keyboard try-it behave as they do in a lesson
- [ ] 6.3 Make the mapping editor an optional step reached from try-it, stating each pad's drum once with the assign and audition controls visually distinct; verify the doubled drum name is gone and that an edit persists across a reload
- [ ] 6.4 State the transport keys in the keyboard flow at the point the student can act on them, and intercept and report them on try-it (a wizard has no run to start, so "act as during a run" is not available); verify both keys are reported only when no interactive element holds focus, and that neither hijacks Space-to-activate on a focused button
- [ ] 6.5 List the keyboard and on-screen pads in the MIDI flow's port list, entering their flow when chosen; verify both appear alongside the fake MIDI ports and that choosing one leaves the MIDI flow
- [ ] 6.6 Enter a virtual flow at try-it when that source has already been stored — the test is a stored mapping, not a pad count, since a pristine virtual controller already has a note on every pad; verify a second visit lands on try-it and a first visit does not

## 7. The gate

- [ ] 7.1 Route a lesson opened with nothing configured to the fork, recording the interrupted lesson and offering a return to it from the flow's closing step, rejecting any destination outside this app; verify with cleared `localStorage` that `/lessons/kick-quarters` (a slug, not the legacy numeric id) lands on the fork, that completing the keyboard choice offers that lesson back and it plays, and that setup entered from the menu offers the ordinary destination instead
- [ ] 7.2 Fire the gate only when nothing at all is configured, as a synchronous decision over stored state that never consults the lesson page's MIDI-derived map (empty until permission resolves, and forever without Web MIDI); verify a machine with a configured MIDI instrument opens the lesson with the fake port removed, and that a no-Web-MIDI browser with a configured instrument is not gated
- [ ] 7.3 Confirm the gate is one choice deep; verify that one click from the fork reaches a configured, sounding instrument for both keyboard and touch, and measure the return hop to the lesson separately (it is a second navigation by design, covered by 7.1)

## 8. Verification across the change

- [ ] 8.1 Walk all three flows under device emulation at 320px, 390px and 500px with a screenshot per step; verify no rail label overlaps another label or marker at 500px where labels are drawn, that markers and lines fit without page scroll at 390px and 320px, and that no page scrolls horizontally at any of the three
- [ ] 8.2 Walk the MIDI flow against all three fake devices plus the no-Web-MIDI case; verify no flow can reach a state whose only exits are Restart and Back
- [ ] 8.3 Confirm the rail's list semantics and current-step marking landed with 1.1 (`list-style: none` strips the list role in Chrome, so the role must be restored explicitly); verify the accessibility tree exposes the rail as a list with the current step marked, rather than as bare text
- [ ] 8.4 Confirm no stored configuration was migrated or rewritten; export a config from `/debug/controller` **before** starting group 1, then verify it still loads, plays and reports the same pad count after the change, and that the geometry field 5.2 adds is absent from it without consequence
- [ ] 8.5 Run `pnpm check` and `pnpm build`; verify both pass
