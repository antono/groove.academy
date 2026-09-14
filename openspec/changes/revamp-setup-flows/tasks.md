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

- [x] 4.1 `/onboarding` is the fork; `/onboarding/keyboard|touch|midi` are the flows, the MIDI body moved to `$lib/setup/midi-flow.svelte`. All seven existing links still land on the fork, and nav highlighting needed no edit — the layout already matches on `startsWith('/onboarding')`.
- [x] 4.2 Synchronous capability probe orders and annotates the three cards, disabling none. Verified on desktop: MIDI leads, touch carries its caveat.
- [x] 4.3 The fork never calls `requestMIDIAccess()` — the probe is `typeof` plus a media query. The header chip inherits the same rule and reports "configured" rather than asking.
- [x] 4.4 The fork carries no step rail at all, and each flow derives its own: 2 steps for a virtual flow, 6 for a grid or neutral MIDI geometry, 7 when the geometry has a pedal. Verified all four counts.
- [x] 4.5 The three flow routes are in `offline-set.ts`.

## 5. The MIDI flow

- [x] 5.1 The `grid | edrum | known | virtual` union is gone. One MIDI flow with a derived step list; "already configured" is an entry condition (`known_`) rather than a path, so the `path === 'known'` branches in `finishTest()` and the pedals and transport Back targets are all removed.
- [x] 5.2 Geometry is a step: shipped schematics, an N x M grid, and a neutral arrangement, offered as peer picture-choices with detection pre-selecting but never deciding. Verified: the Medeli kit pre-selects its schematic with the family caveat, the MPD218 pre-selects a 4x4 grid, and an unrecognised device pre-selects **nothing** — no preview, continue disabled — until the student answers. No stored field was needed after all: geometry already round-trips, because `toJSON` writes cols/rows whenever the geometry is a grid and `fromStored` reads those before consulting the profile.
- [x] 5.3 Make Skip and early-Done available for every geometry — they were `isKit`-gated, so a grid student who could not land all sixteen note-ons had no way forward but Restart or Back. Verified on the unrecognised device: `Skip` present from the first pad, `Done →` appears once one pad is mapped, and skipping leaves that pad unmapped.
- [x] 5.4 Replace `playScaleTone` with the mapped drum for every geometry (keeping the `adoptGmSound` guard: see below); `playScaleTone` is no longer imported by setup at all. The capture toggle now reads "Play the drum on each hit" everywhere, instead of offering a grid student an A-minor tone in a drum trainer. Out-of-range notes still leave the suggested sound alone, `isDrumNote` being 35..70. **Correction:** this task also dropped `adoptGmSound`'s kit guard, on the reasoning that a GM-mapped grid makes the same claim a module does. It does not — a grid's notes are usually one chromatic run meaning only "which pad" — and dropping the guard overwrote the grid's own layout, so a controller sending 48 upward ended up with no snare, kick or hat. The guard is restored as an explicit `notesAreGm` prop. Verified both ways: a grid mapped from notes 48-63 keeps `[…36, 38, 42, 46]`, and a module sending 41 where its profile suggested 43 still overrides the profile.
- [x] 5.5 The pedals step is in the step list only when the chosen geometry has a pedal pad; `classifyHihat()` and `pedalMessage()` are untouched. Verified by rail length: 7 for the MD-90, 6 for a grid or neutral geometry.
- [x] 5.6 Try-it is now on every geometry's path, not just a kit's — the unified step list puts it between capture and the transport step, so a pad grid's mapping is proven before a lesson rather than during one.
- [x] 5.7 Entry at try-it when the chosen port already has a mapped pad, from the same predicate as before; a config with no notes still routes into capture.
- [x] 5.8 A re-map keeps the geometry the instrument was configured with — `useKnown` restores it from `controller.geometry` — and clears only the notes, so sounds, labels and a correct hi-hat classification survive.

## 6. The keyboard and touch flows

- [x] 6.1 Both virtual flows reach a playable instrument with no mapping step, saving on entry so they count as configured. Verified: the chip reads "Keyboard — connected" the moment the flow opens, and returning to a lesson is not re-gated.
- [x] 6.2 Try-it renders the real `virtual-pads.svelte` and the real key listener. Verified: pressing F reports "That was the Kick." — the same GM note a lesson receives, via the component's own `onhit`.
- [x] 6.3 The drum editor is a detour reached from try-it rather than the flow itself, and states each pad's drum once with a separate ▶ audition control.
- [x] 6.4 The keyboard flow states Space and Esc and reports them on try-it — a wizard has no run to start. Verified both are reported, and that Space while a button holds focus is _not_ intercepted, so activation still works.
- [x] 6.5 The MIDI flow's port list carries the keyboard and the on-screen pads below a rule, so a student who connected a controller and then thought better of it can say so there rather than retracing their steps. Choosing one leaves the MIDI flow for its own, carrying any return intent with it.
- [x] 6.6 A virtual flow that has already been stored opens at try-it; the test is a stored mapping, not a pad count.

## 7. The gate

- [x] 7.1 Opening a lesson with nothing configured routes to the fork carrying `?next=`, and the flow's closing button reads "Back to the lesson →". Verified the whole round trip on `/lessons/kick-quarters`: gated, keyboard chosen, returned, and not gated again.
- [x] 7.2 The gate is a synchronous decision over stored state and never consults the MIDI-derived map, which is empty until permission resolves and forever without Web MIDI.
- [x] 7.3 One click from the fork reaches a configured, sounding instrument for both keyboard and touch; the return to the lesson is a second navigation by design, covered by 7.1.

## 8. Verification across the change

- [x] 8.1 Walked the fork and both virtual flows under device emulation at 320px, 390px and 500px. No rail label overlaps at 500px where labels are drawn; markers fit at 390px and 320px; no page scrolls horizontally at any width. The touch flow's pads measure 134x134 at 390px, well above the minimum target.
- [x] 8.2 No flow can reach a state whose only exits are Restart and Back: Skip and early-Done are present on every geometry, and an unrecognised device's geometry step disables Continue until it is answered rather than trapping anyone. The no-Web-MIDI fork was walked too — the leading card is one that works and the MIDI card is still selectable.
- [x] 8.3 Confirmed with 1.1: the rail is `role="list"`/`"listitem"` with `aria-current="step"` on the active item. Verified against the DOM rather than the MCP accessibility snapshot, which flattens list wrappers and omits aria-current — that snapshot is not a valid way to check this.
- [x] 8.4 A configuration in the pre-change shape — flat `notes`/`soundNotes`/`cols`/`rows`, no `kind`, no `pads` — loads, is reported as configured, opens a lesson without being gated, and the stored blob is byte-identical after reading. No migration and no rewrite on read; no geometry field was added in the end, so there is nothing for an older blob to lack.
- [x] 8.5 `pnpm check` clean at 323 files, 0 errors, 0 warnings; `pnpm build` succeeds.
