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
- [x] 1.3 Extract the capture walk into `$lib/setup/capture-loop.svelte`, owning the order, the lit pad, undo/skip/restart and its own bounce filter; the caller feeds it notes via an exported `feed()` and binds `index`/`total` to render the footer. `audition`/`flashHit` are private copies — the page keeps its own for the pedals and test steps, which is four lines against giving three steps one flash state to fight over. The pedals step now has its own `lastPedalNote`/`lastPedalAt`, so a gesture reusing the last captured pad's note is no longer swallowed as a bounce. Verified: two sends of note 42 forty ms apart took one pad, not two; undo steps back; a partly-walked grid followed by a kit starts at `1 / 7 Snare` rather than resuming the grid's position (a regression I introduced by calling `loop.restart()` before the component mounts — the caller now resets the bound index).
- [x] 1.4 Fix the `captureIndex` / `padIndex` divergence so the capture step reads the highlighted pad through `captureOrder`; verified by walking the Medeli kit (named drum matches the newly-lit drum at every step, counter `1/7` confirming the pedal is excluded). The divergent ordering is unreachable in the shipped app — one profile, pedal last, and `buildCustomPads` sets no pedal — which is why it was latent; `current`, the preview's `captureIndex` and both editors now read the one index by construction. Re-verify against a real divergent profile when 5.2 makes pedal roles assignable.

## 2. Active instrument as one authority

- [x] 2.1 Add `$lib/active-instrument.svelte.ts` — one object with getters, not exported `$derived` constants, which are read once at import and would hand every consumer a snapshot. Resolution is session choice → persisted → none, and a persisted id whose config has gone resolves to none. `Controller.save()` no longer writes `selectedDevice`, so setting up a second kit cannot silently steal the selection from the one being played.
- [x] 2.2 `anyConfigured` counts hardware with a mapped pad plus virtual sources that have been _stored_, asking about the reserved `:` ids explicitly because `Controller.list()` skips them. Verified: no chip before any setup, chip present immediately after a flow saves.
- [x] 2.3 The lesson page reads and writes the selection through the store and no longer invents `(coarse ? touch : keyboard)` on mount. Two gaps this exposed and fixed: the port effect was a second writer of the key, and the chooser showed a blank selection because a configured instrument whose port is not enumerated yet was missing from its own options list — MIDI access is only requested on the first Play. Verified: chooser shows `e-drum` selected at rest with options `[e-drum, Keyboard, On-screen pads]`.

## 3. Header instrument chip and switcher

- [x] 3.1 Header chip naming the active instrument, hidden when nothing is configured. Verified absent on a cleared `localStorage` and present naming `e-drum` right after a flow completes.
- [x] 3.2 Three states — present, absent, unknown — reading presence only from ports published by a surface that already holds access (the lesson page and the MIDI flow both publish; the chip never requests). Verified: `configured` on the wizard before connecting, `connected` after. The `absent` branch is `ports.includes(id)` on the same published array and is exercised by the `connected` case; the fake-MIDI harness could not drive a live disconnect — its `onstatechange` did not reach the hub — so that one branch is verified by construction rather than end to end.
- [x] 3.3 Dropdown listing configured instruments plus "Set up another…". Verified with two instruments configured: menu lists both, selecting the other makes it active and the chip renames without a reload.
- [x] 3.4 Run-in-progress state in the store, set when a scored run starts and cleared by `stop()` — which `finish()` and `onDestroy` both call, so an abandoned run cannot lock the chip. A paused run still counts. The menu's entries are disabled while it is set and say why.
- [x] 3.5 Chip fits the collapsed header at 320px: compact to a 44px square showing only its state dot, full name kept in the accessible name and title, and the brand wordmark yields below 22.5rem. Two bugs found doing it — `max-width: none` let the compact chip flex to 249px, and `.sr-only` was scoped to `+layout.svelte` so the chip's screen-reader text rendered visibly and made it 93px tall; `.sr-only` is now a global utility in app.css. Verified at 320px: chip 44x44, header one row, no horizontal scroll.

## 4. The fork

- [ ] 4.1 Add `/onboarding` as the fork screen offering keyboard, touchscreen and MIDI, with `/onboarding/keyboard`, `/onboarding/touch` and `/onboarding/midi` as the flow routes; verify each flow route enters its flow directly and that every existing link into `/onboarding` still lands on the fork
- [ ] 4.2 Add the synchronous capability probe — `typeof navigator.requestMIDIAccess` and `matchMedia('(pointer: coarse)')` — ordering and annotating the three cards without disabling or hiding any; verify with Web MIDI deleted that the leading card is one that works, that the MIDI card still selects, and that no disabled control is the most prominent element
- [ ] 4.3 Confirm the fork never calls `requestMIDIAccess()`; verify by loading the fork with a `requestMIDIAccess` stub that never resolves and checking the cards are still selectable
- [ ] 4.4 Make the rail show nothing flow-specific on the fork and derive from the chosen flow thereafter; verify the first screen no longer promises five steps and that each flow's rail step count equals the screens actually walked
- [ ] 4.5 Add the three flow routes to `offline-set.ts`; verify by `pnpm build && pnpm preview`, then calling `warmOfflineSet()` from the console (build+preview alone never fetches the offline set — it fires on install or the standalone heuristic), confirming the three exact paths are in the versioned cache, then going offline and navigating to each

## 5. The MIDI flow

- [ ] 5.1 Replace the `grid` / `edrum` / `known` / `virtual` `Path` union with one MIDI flow plus an already-configured entry condition, removing the `path === 'known'` branches in `finishTest()` and the pedals and transport Back targets; verify `pnpm check` is clean and no `path ===` comparison remains
- [ ] 5.2 Add the geometry step offering schematic, grid and neutral as a picture-choice at a matched size (pass an explicit preview size — capture mode resolves to `lg`, for which the kit renderer has no rule), pre-selected from `matchDevice()` but never decided by it, persisting the choice as an additive optional field, and defining the winner when a device matches both a kit profile and a grid preset; verify the fake Medeli kit pre-selects its schematic, the fake MPD218 a 4×4 grid, the fake unrecognised device nothing while still offering every choice, and that a grid chosen for the Medeli kit loads back as a grid
- [x] 5.3 Make Skip and early-Done available for every geometry — they were `isKit`-gated, so a grid student who could not land all sixteen note-ons had no way forward but Restart or Back. Verified on the unrecognised device: `Skip` present from the first pad, `Done →` appears once one pad is mapped, and skipping leaves that pad unmapped.
- [x] 5.4 Replace `playScaleTone` with the mapped drum for every geometry and drop the `isKit` guard on `adoptGmSound`; `playScaleTone` is no longer imported by setup at all. The capture toggle now reads "Play the drum on each hit" everywhere, instead of offering a grid student an A-minor tone in a drum trainer. Out-of-range notes still leave the suggested sound alone, `isDrumNote` being 35..70.
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
