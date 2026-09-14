# Changelog

Notable changes, newest first. **User-facing** is anything you would notice
while practising; **internal** is everything else — tooling, docs, and work that
only shows up in how the project is built.

Announcements for each release live in [`/news`](src/lib/news/); this file is
the complete list, that one is the readable half.

## v0.3.0 — 14 September 2026

The Music tier, and a setup that asks instead of guessing. Twenty-four commits.

### User-facing

**Thirty new lessons — 62 playable become 92, and the Music tier opens.** Three
stages, all fully written, none planned.

- **Music 1 · Form & Fills** — the push (a down-beat moved early, and the hole it
  leaves), the 16th fill in three escalations, and song form. The first
  eight-bar lessons in the app: `bars=8` was always in the schema and is now
  confirmed end to end through the chart, the highway and the scoring, which
  retires the "8-bar forms" blocker in `docs/curriculum.md`.
- **Music 2 · Styles: The Radio** — rock, funk and hip-hop as one skeleton with
  three kick vocabularies. The snare holds 2 and 4 throughout; only the kick and
  the tempo change, so the genre is audibly the thing being learned rather than
  a new limb.
- **Music 3 · Styles: The Dancefloor** — house, breaks and reggae change the
  skeleton itself. The hat comes off the beat, the snare leaves the backbeat,
  and the one drop leaves beat 1 empty on purpose — which is Foundations 3 ·
  Space arriving as a style rather than an exercise. Drum & bass's two-step is
  written honestly at 160.

Music now owns stages 10–12 and Mastery moves to 13–14. Vocabulary's stages 8
and 9 stay designed-but-unwritten, so `CURRICULUM` jumps 7 → 10: stage numbers
are stable, not positional, and a lesson's practice history and remembered tempo
are keyed by slug either way.

**Two real electric basses, and a voice per line.** Picked Bass YR and Finger
Bass YR — one Yamaha RBX recorded by Andrea Biasior, CC0, via FreePats — join
the three synths, and every backing line is now bound to the instrument its
character asks for: the conversational lines on the finger bass, the quarter
pulse and the boogie on the pick, the machine lines on the synths. The lines
themselves learned to phrase, where they previously ran at flat velocity —
quarter walks bar 4 home through G–B–D–E, octave runs a fifth into its
turnaround, syncopated closes on a B/G♯ enclosure — and the pedal and dub lines
the module had promised in a docstring for months now exist, ready for the
styles stages that needed them.

**Setup asks what you play on.** The wizard used to decide from a regex on a USB
port name, with one kit schematic shipping — so nearly every real electronic kit
was routed into a screen titled "Pad layout", with a text link below the fold as
the way out, and on iOS Safari the page opened on a disabled Connect button.
`/onboarding` is now the question itself: three cards ordered by what the
browser can actually do, never disabled, and a browser with no Web MIDI says
what it needs instead of leading with a dead button.

- Each flow has its own address — `/onboarding/midi`, `/onboarding/keyboard`,
  `/onboarding/touch` — and all three are cached for offline.
- **Geometry is a step, not a path.** Shipped schematics, an N × M grid and a
  neutral arrangement are offered as peers. Detection pre-selects and names one
  but never decides it, and an unrecognised device pre-selects nothing rather
  than being quietly called a grid.
- **Every flow ends by proving itself.** A pad grid's mapping was never tested
  before a lesson, and the keyboard and on-screen pads had no test step at all.
  The pedals step appears only when the chosen geometry has a footswitch.
- Skip and an early Done are no longer kit-only: a grid student who could not
  land one note-on previously had no way forward but Restart or Back. Capture
  auditions the actual drum on every geometry, where a grid used to answer with
  a melodic tone.
- The MIDI port list now offers the keyboard and the on-screen pads below the
  ports, so thinking better of a controller is a click rather than a step back.
- **Practice is gated on setup, one choice deep.** Opening a lesson with nothing
  configured routes to the question and remembers where you were going, so
  finishing a flow lands you on the lesson you asked for.

**One active instrument, named in the header.** A chip in the header says what
you are playing, distinguishes connected from configured-but-unplugged, switches
between the instruments this machine knows and offers to set up another. The
lesson page no longer invents an input on mount — picking one silently is what
let a student practise on the on-screen pads without ever being told — and
setting up a second kit no longer steals the selection from the one being
played. Switching mid-run is refused, because the scoring is against the
mapping. The lesson page's own input picker and its "Playing on …" line are
gone: the chip says it once.

**Restart without leaving the highway.** A fumbled first bar meant riding out
the lesson or stopping and starting again from the resting page. The transport
HUD now carries Restart: the score is dropped, every scheduler cursor rewinds
and the count-in leads back in on the click, with nothing to wait for because
audio and samples are already up. Nothing is filed either way — a run only
reaches your practice history by finishing.

**The Stats link appears once there are stats.** An empty heatmap and four flat
charts tell a new student nothing except that they are already behind. The link
arrives the first time a run is banked, without a reload, and `/stats` stays
reachable by URL regardless.

**The footer names where the project talks and where it is written** — a
Telegram channel and the source repository, beside Mastodon.

### Internal

- `$lib/active-instrument.svelte.ts` replaces four independent readings of
  `groove-master:selectedDevice` with one object. `set()` is write-only —
  choosing an instrument does not change which instruments exist — because a
  revision bump inside it made the lesson page's MIDI effect depend on what it
  wrote, exceeded the update depth on hydration and rendered nothing at all. The
  configured list is cached against that revision rather than walking and
  JSON-parsing every localStorage device row on each property access.
- `$lib/setup/` is new: `midi-flow.svelte` and `virtual-flow.svelte` behind the
  routes, plus `capture-loop.svelte` owning the capture order, the lit pad,
  undo/skip/restart and its own bounce filter. The pedals step gets bounce state
  of its own — it shared one pair of variables with the capture walk, so a
  footswitch sending the same note as the last pad captured was swallowed as a
  repeat and looked like a dead pedal.
- `$lib/wizard-rail.svelte` and `$lib/wizard-card.svelte` carry the chrome every
  step repeated. The rail overlapped its own labels between ~481px and ~560px
  (`flex: 1` gave every step an equal share, so "Map pads" truncated while
  "Grid" sat in slack); it now marks the current step with `aria-current` and
  restores the list role Chrome strips from a `display: flex` list.
- The `grid | edrum | known | virtual` path union is deleted. "Already
  configured" is an entry condition, not a path. No stored field was needed for
  geometry: `toJSON` already writes cols/rows for a grid and `fromStored` reads
  them before consulting a profile.
- A GM-mapped pad grid does **not** adopt its note numbers as drum sounds. A
  module sending 38 for its snare states what that pad _is_; a grid sending 48
  for its first pad states only which pad it is. Dropping that guard mid-series
  produced a 4×4 with no snare, kick or hat; it is back as an explicit
  `notesAreGm` prop so the reason is legible at the call site. Re-mapping a grid
  rebuilds its layout rather than preserving sounds it has no way to edit, which
  is what lets a broken grid be repaired.
- The return destination the practice gate remembers is treated as untrusted:
  in-app paths only, and `//host` is rejected too.
- `hasSessions()` in `$lib/stats.ts` is a count, not a fetch — the navigation
  asks on every page, and pulling the whole history to answer "any?" would grow
  with the student.
- `render-bass.py` audits every render with sox, drops silent files and writes
  each bass's true range to the manifest; `make-lessons.py` checks a line
  against the chosen bass's own range rather than the global one, so a line
  written for a synth cannot silently lose notes on the electric.
- openspec: the setup-flow revamp is proposed, designed with three validated
  mermaid flows, implemented across 39 tasks and archived to
  `changes/archive/2026-09-14-revamp-setup-flows`. New capabilities
  `setup-flows` (7 requirements) and `instrument-switcher` (5); `edrum-setup`
  drops four that moved or dissolved. 15 specs validate, no active changes
  remain.
- `README.md` replaces the `sv` scaffold with a real front page — the
  Melodics/Belarus story, four screenshots from the running app kept in
  `docs/readme/` where `.vercelignore` excludes them, the tier table, and a
  quick start built on devenv + direnv.
- `.envrc` enters the devenv shell on `cd`. A stray `.env*` at the end of
  `.gitignore` was shadowing the Env block above it, hiding `.envrc` from git
  and re-ignoring `.env.test`.
- The 12 OpenSpec workflow skills and `design-doc-mermaid` are vendored into
  `.agents/skills` and recorded in `skills-lock.json`; `.prettierignore` keeps
  `skills update` from producing reformatting noise.

## v0.2.0 — 22 August 2026

Forty more lessons, and an app you can install. Ten commits.

### User-facing

**Forty new lessons — 22 playable become 62.** Four stages that were slots in
the catalogue are now written out.

- **Foundations 3 · Space** — the notes you do not play. Every pattern is a
  Stage 2 groove with a beat, a half bar or a whole bar taken out of it, and
  coming back in exactly on time. It adds no new limb and no finer grid on
  purpose: silence is where a beginner's time actually fails, because inside a
  run of notes the hands cover for the clock.
- **Foundations 4 · The Cymbals** — ride, crash and open hat on rhythms you
  already own. The palette is exactly the six pads the on-screen controller
  ships with, so every lesson in the stage is playable with no hardware.
- **Foundations 5 · Two Bars** — form. Bar 2 answers bar 1, a crash marks the
  top of a four-bar phrase, and the last two beats hand it back. Nothing finer
  than an 8th and nothing off the beat, so knowing where you are is the only
  new thing being asked.
- **Vocabulary 1 · Subdivision & the Grid** — 16ths, triplets, and the feel
  between them, ending on the shuffle and the half-time shuffle. "Broken
  Triplets" is derived from the full triplet by dropping every middle note, so
  the shuffle being a triplet with a hole in it is true by construction rather
  than by assertion.

Inserting three stages renumbers everything from Subdivision on, but nothing you
own moves with it: practice history and remembered tempos are keyed by lesson
slug, and the displayed number has always been rendered from position.

**The app installs.** Add Groove Academy to a home screen or a dock and it opens
in its own window with no browser furniture. Installing precaches your kit, the
basses, the lessons and the main pages — about a megabyte, not all twelve kits —
so a practice session survives a dead connection; a route you have never opened
lands on an offline page that says so rather than a browser error. App shortcuts
go straight to **Continue lesson**, **Stats** and **News**.

**A phone layout, not a shrunken desktop one.** Below 48rem the nav folds into a
full-screen menu (Escape closes it, so does following a link, and the page
behind it stops scrolling); tiers, stages, lessons and news posts are tappable
across their whole face; the result screen fills the screen with its buttons in
thumb reach; touch targets are 44px on coarse pointers, and nothing scrolls
sideways at 320px.

**The highway really does shrink in portrait now.** It was documented to and
never did — the narrow constant was 110 pixels per beat, identical to the wide
one. At 78 the lookahead goes from about 2½ beats to about 3½. The transport HUD
also came to 327px on a 320px phone and hung off the left edge; under 30rem it
drops its words for glyphs, keeping the words in the accessible name.

**Every module's third lesson was unreachable from the catalogue.** "stretch" is
a curriculum word as well as a CSS one, so the rule that makes a card clickable
was matching the _stretch_ badge too and laying a dead overlay over the card.
Clicks on it went nowhere.

**Cymbals have a colour of their own.** A crash or a ride used to fall through to
the by-lane fallback, so the same drum was the hat's colour in one lesson and the
snare's in the next, depending on how many lanes the lesson had. All seven
cymbals now share the hat's hue, which is what a colour-by-family map is for.

**Nothing fetches samples while you are playing.** The idle warm-up carries a 3 s
timeout and so fires whether or not the page ever went idle — start a run inside
that window and a few dozen requests burst through while the highway is
scrolling. It is now cancelled by Play and by Listen, and nothing is lost: a run
preloads exactly those samples before its first beat anyway.

### Internal

- `make-lessons.py` fails on a backing note outside the rendered bass range. One
  was a 404 at playback and nothing else — invisible in the MIDI, invisible on
  the chart, visible only in the dev server's log.
- Lesson-authoring additions: a `SHUFFLE` bass line, the only one written on the
  triplet grid (in triplet feel the straight ladder stops sorting by support, so
  the feel modules fade shuffle → quarter → straight); `TRIPLETS` and `SWUNG`
  position sets, PPQ 480 being divisible by three so a triplet lands _on_ the
  grid; `CRASH` and `RIDE` note constants.
- The guide-hat rule becomes a timekeeper rule: a ride does the hat's job and no
  longer gets a guide hat laid over it; a crash does not, and still does.
- `docs/highway-jitter-rca.md` — the highway stutter on one Linux laptop is GPU
  power management, not the app: on battery the integrated GPU idles at 300 MHz
  of a 950 MHz ceiling and misses the 16.7 ms composite deadline. The one real
  defect found on the way (the idle warm-up above) is fixed.
- `TODO.md` records the audit written alongside Foundations 3–5, each item
  reproduced. Top of the list: `MATCH_WINDOW_BEATS` is 0.4 while a 16th is 0.25
  beats away and a triplet 0.33, so a doubled hat in a 16th run claims the next
  note instead of scoring as an extra.
- `scripts/render-icons.sh` renders the icon set; committed rather than wired
  into the build, like `check-kits.py` — `.vercelignore` excludes `scripts/`.
- `$lib/analytics.ts` tracks the install funnel as three events; `$lib/pwa.svelte.ts`,
  `$lib/offline-set.ts`, `$lib/breakpoints.ts` and `$lib/install-strip.svelte` are new.
- Page documents are network-first with an `/offline` floor, matched on path
  rather than `request.mode` — the warm-up uses an ordinary `fetch()`, so keying
  off "navigate" would have cached nothing.
- `/lessons/continue` resolves "my next lesson" client-side and replaces itself
  in history, so a fixed shortcut URL can point at it and Back still works. It
  shares `continueTarget()` with the landing button, so "continue" cannot come to
  mean two different lessons. `continue` joins the reserved lesson slugs.
- openspec: `virtual-controllers`, `mobile-ux`, `edrum-support` and
  `sync-local-data` archived and their specs synced into `openspec/specs/`.

## v0.1.0 — 17 August 2026

The app stopped needing hardware. Twelve commits.

### User-facing

**Play with no controller at all.** A computer keyboard and a grid of on-screen
pads are now input sources in their own right, offered on setup's first step
under "No controller?". Six pads — kick, snare, closed and open hi-hat, crash,
ride — which is every drum the curriculum leans on. On a keyboard they sit under
`F G H` with `R T Y` above, bound by **physical key position** rather than the
printed letter, so the shape holds on AZERTY and Dvorak; `Space` starts and
resumes, `Escape` pauses and stops on a second press. They are ordinary sources
rather than a fallback mode: chosen
from the same device list, edited with the same per-pad dropdown, and recorded in
your stats under their own name, so keyboard practice stays tellable apart from
kit practice.

**A touchscreen can play a lesson.** No mobile browser implements Web MIDI, so a
phone or tablet previously had no way in at all. The on-screen pads lay out 2×3
to fit a phone and 3×2 wider, sit beside the pattern chart exactly where a kit's
schematic does, and take the room below the lanes during a run.

**A get-ready cue.** On a touch run, the pad whose note is approaching the hit
line rings about a beat ahead — you are looking at your fingers, not the highway,
so the cue goes where your eyes already are. Only touch runs pay for the
per-frame work.

**A calmer highway.** Notes travel 110 pixels per beat instead of 280, so at any
tempo they arrive from further off and much more of the pattern is readable
before it reaches you. Scoring is unaffected: it reads the audio clock and never
pixels.

**Kit pads that sound like the drums they are.** A drum module that names its
pads in GM knows more about them than a profile written from a photograph, so on
a kit a captured note we hold a sample for now becomes that pad's sound,
overriding the profile's suggestion. The MD-90's toms are corrected against real
hardware (47/45 → 45/43). Pad grids are untouched — an MPD218's notes are
addresses, not drums.

**Fixed: revealing a quote's testimonial shoved the buttons away.** It rendered
in the flow, pushing Like/Dislike down as it appeared. It floats now, and neither
the quote nor its buttons move.

### Internal

- `/debug/controller`: the stored mapping as a record rather than an
  interpretation — every pad with the note it listens for and the drum it fires,
  the hi-hat wiring, the transport bindings, plus a live monitor of what
  `Controller.handle()` makes of each incoming message. Exports and imports that
  record as JSON, and **import always re-targets**: a mapping is keyed by MIDI
  port id and browsers scope that per origin, so the id inside a file cannot be
  honoured.
- The production build no longer runs `scripts/check-kits.py`. `.vercelignore`
  excludes `scripts/`, so the v0.0.4 deploy died on the host with a missing-file
  error five seconds in; the check stays in `pnpm check`, where authoring checks
  belong.
- The WTFPL licence file is removed. No project licence ships with the source for
  now; the licence mentions left in `THANKS.md` are third-party sample credits.
- Release process: version numbers stay out of announcements — they live in the
  annotated tag and this file, and nowhere a reader looks.
- openspec: a `virtual-controllers` change (proposal, design, six requirements,
  tasks) written before the work and updated through it; `lessons-layout`
  archived and a baseline `lessons-catalogue` spec captured from its delta.
- devenv: agent skills are discovered from the tool-neutral `.agents/skills` and
  mirrored into `.claude/skills` on shell entry, so one copy serves every
  assistant; devenv and nixpkgs inputs bumped.

## v0.0.4 — 13 August 2026

The app stopped assuming what you play it on. Nine commits.

### User-facing

**Electronic drum kits.** Until now a controller had to be a rectangle of pads;
an e-drum kit could only be set up as a grid with most of its cells empty, in an
order you had to invent. There is now a second setup path that shows a kit as a
kit — its drums where they actually sit on the unit — and walks them one at a
time. A **Millenium MD-90** profile ships with it, matched by its maker: the
module announces itself as `e-drum` by `Medeli`, which is what it is, so the
wizard offers the layout rather than asserting the model.

**Your feet, discovered rather than assumed.** A pedals step captures the bass
pedal, then works out how your hi-hat is actually wired from three gestures —
some kits send one note and let the pedal decide, some send two different notes,
some have no pedal at all. Every pedal is skippable on its own, and what you
skipped is stated, so a kick that will never sound is something you learn before
a lesson rather than during one.

**Lessons know what your kit can't play.** If a lesson needs a drum your setup
cannot produce, the page says so before the run instead of letting those notes
surface as misses nobody can explain.

**A controller you have already set up is checked, not re-mapped.** Reconnecting
a known device goes straight to a screen where you hit pads and it names both the
pad and the drum it plays, and sounds it. Pressing all sixteen again to arrive
back where you started was never setup.

**Your instrument sits beside the lesson.** The pattern chart already said
_when_; the picture of your own controller now says _where_ — the drums a lesson
uses named in the same colours the chart gives them, and lighting as you hit
them. During a run it appears under the highway when there is room for it.

**The catalogue is a drill-down.** `/lessons` opens on four tiers, each with the
question it answers; open a tier for its stages and a stage for its lessons.
Stages are numbered **within their tier**, so you read "Vocabulary · Stage 1"
rather than a running total, and a **Continue** button goes straight to where you
left off.

**Quote ratings follow you between devices**, and a failure in one part of sync
can no longer take the rest down with it — progress, runs and ratings now
reconcile independently, so one dataset erroring cannot abort or hide the others.

**A "How it works" section on the landing page**, with larger section headings
and even spacing.

**Lesson text names stages instead of numbering them** — "the alternation from
Pulse" rather than "Stage 1's alternation" — because tier-local numbering makes
a bare "Stage N" ambiguous.

**Fixes**

- A hi-hat pedal at rest reads as _open_, which is right for a drummer and
  useless here: the lessons are overwhelmingly closed hats, so every hat you hit
  scored nothing unless you held the footswitch down for the whole lesson. Worse,
  it failed silently — the controller picture lit either way, so the hits looked
  like they landed. A lesson that uses one hi-hat voice now pins the hat to it;
  only the two lessons using both leave the pedal in charge.

### Internal

- **A `Controller` abstraction** (`$lib/controller.svelte.ts`): one object for
  the student's instrument and a facade over what its inputs mean. `handle()`
  turns a MIDI message into a hit with the GM note already resolved, a pedal, a
  transport press, an unmapped note, or nothing — replacing a note map, a
  transport check and a geometry triple that each page assembled for itself.
  Grid and kit share one internal shape, so `kind` is consulted when building a
  controller and essentially nowhere afterwards.
- `$lib/controller-preview.svelte` becomes the only thing that draws pads, in
  three modes over geometry taken from the controller, absorbing and retiring
  `pad-grid.svelte` and `controller-map.svelte`.
- Kit profiles describe a model, never a MIDI note: a module's pads are
  reassignable from its own panel, so notes are always captured. Profile
  schematics are geometry-only SVGs under `static/kits/`, inlined so drums can
  be marked by id — first-party assets exclusively.
- `scripts/check-kits.py` fails `pnpm check` when a profile and its schematic
  drift apart in either direction. Not wired into `pnpm build`: `.vercelignore`
  excludes `scripts/`, so a build gated on it cannot run on the deploy host.
- Device identity folds in the manufacturer and strips zero-width and bidi
  control characters — the MD-90 appends U+202D to its maker string.
- A `device_layouts` table for opt-in sharing of a layout we have no profile
  for: insert-only, with no select policy for anyone, so it is a write-only
  mailbox rather than a catalogue the app reads back.
- `/debug/settings` refuses a drum kit rather than flattening it into the 4×4
  grid it hard-codes.
- Saved controller configs from before this release load unchanged and are never
  rewritten on read; the `notes`/`soundNotes` pair is still written for
  consumers that predate the class, so nothing needed migrating.
- OpenSpec: `edrum-support` change added; `lessons-layout` drafted and completed;
  `sync-local-data` planned and partly delivered.

## v0.0.3 — 11 August 2026

Practice stopped being tied to one browser. Ten commits.

### User-facing

**An optional account, and cloud backup behind it.** Email magic-link sign-in —
no password. Signed in, earned tempo ceilings, unlocked lessons and every scored
run back up in the background and return on any device. Signed out the app is
unchanged: fully usable, fully offline, nothing withheld. First sign-in adopts
whatever that device had already practised instead of discarding it, and signing
out keeps the device's own copy.

**Two devices cannot undo each other.** Progress merges by taking the best of
both (higher ceiling, union of unlocked lessons); runs are append-only and
de-duplicated by id. A week on one machine and a week on another add up rather
than the later sync winning.

**Quote of the Day between lessons.** _Next lesson_ on a result screen shows one
line from a drummer or producer before the next lesson loads. The author's name
reveals who they are and where the line is from; like/dislike advances, and
_never show quotes_ ends them for good. 58 quotes, unseen ones preferred until
the set is exhausted. Ratings are stored on the device.

**The practice heatmap fits its window.** It drew 53 weeks whatever the space —
now it draws the weeks that fit, measured from the card rather than a breakpoint,
so it tracks a resized window: a year on a laptop, around 18 at 360px, never
fewer than 12. The header says how many weeks are shown.

**Fixes**

- `/lessons` and `/stats` could both render blank. The sync work moved the
  practice-history store to version 2, and an older connection in another tab or
  in bfcache blocks that upgrade — with no `onblocked` handler the open request
  never settled and both pages waited on it forever. It now gives up and retries
  later, yields when another tab needs the upgrade, and `/lessons` draws its
  cards without awaiting history at all.
- The Quote of the Day never appeared: the component shipped in its feature
  commit but was never imported by the result screen.
- The quote's author testimonial covered the quote it belonged to. Floating it
  above the author put it exactly where the citation's last line is, so a long
  bio hid the words being credited. It sits in the flow under the author now, and
  the overlay is top-anchored rather than centred — which is what makes that
  safe: a centred column shifted up by half of whatever the reveal added, moving
  the author out from under the pointer and flickering the bio on and off. The
  quote and author no longer move at all.
- The heatmap's day tooltip was clipped by the scroller it lived in — 55px off
  the right on the last column, 35px off the top on the first row. It is
  fixed-positioned and clamped to the screen now, flipping below the mark when
  there is no room above and dismissing on scroll. The card header also wraps as
  a unit instead of breaking its title mid-phrase.

### Internal

- Supabase integration: `@supabase/ssr` magic-link auth with SSR-validated
  sessions (`hooks.server.ts` `safeGetSession` → `getUser`), owner-scoped
  `lesson_progress` and `sessions` tables with RLS, and a background
  `reconcile()` sync engine (`$lib/sync.ts`). `adapter-auto` → `adapter-vercel`,
  since cookie auth needs SSR.
- A `quote_ratings` table and migration exist with RLS and last-write-wins
  merge, but **rating sync is not wired**: there is no `syncRatings` in
  `$lib/sync.ts`, so ratings are device-local. Noted as a follow-up when the
  openspec change was archived.
- `scripts/make-quotes.py` builds `static/quotes/quotes.json` from
  `docs/groove_academy_quotes.csv`; ids are `<author>-<8-hex citation hash>`.
- Analytics: `signinLinkSent` / `signinLinkFailed` on `/account`. No email
  address or error text is sent as a parameter.
- `supabase/config.toml` from `supabase init`, with `[auth]` aligned to the live
  project so `config push` stays surgical; `supabase/SETUP.md` documents the
  Vercel env and auth-config steps. `supabase-cli` and a `vercel` script added to
  `devenv.nix`, which also generates the shared MCP configs into the Nix store.
- `.vercelignore` keeps `soundfonts/` (244 MB, over Vercel's 100 MB per-file
  limit) and the dev-only directories out of CLI deploys.
- News posts can carry screenshots: `$lib/news-article.svelte` styles
  `figure`/`img`/`figcaption`, and images live at `static/news/<slug>/`.
- `AGENTS.md` gained a **Releases** section — the version/changelog/news/tag/
  announce flow, and how to shoot the screenshots.
- openspec: `supabase-integration` and `quote-of-the-day` archived, capabilities
  synced into `openspec/specs/`.

## v0.0.2 — 8 August 2026

Lessons went from stopping to ending. Fourteen commits since launch.

### User-facing

**Lessons now finish instead of running out.** Every pattern lands on the bar
line that follows it: whatever sounds on beat one sounds once more at the end,
and the bass resolves onto the root note underneath it, after the drums have
stopped. The closing hit is scored, and the transport runs a beat past it so it
can actually be played rather than counting as a miss by construction.

**A borrowed hi-hat for lessons that had none.** Four early lessons left you
counting in silence between your own hits. They now have closed hats ticking on
the 8ths underneath — audible on the lesson's own kit, never shown on the
highway and never scored.

**A new bassline for lesson 1.1.** The old one played the root on all four beats
— the same beats as your kick, so it was masked by your own playing, and it
repeated one pitch a bar. The new line answers on the off-beats, in the gaps.

**New lesson: 4.5 Paradiddle Groove.** The core slot of the paradiddle module —
the same sticking as 4.4 with a kick on beats one and three underneath.

**Three highway sizes.** A button in the transport bar cycles compact (a thin
band with only the notes moving), medium (the same band at double height) and
full (the original, lanes filling the viewport). Safe to change mid-run,
remembered across lessons.

**Note colours no longer collide with scoring colours.** Drum-family colours and
timing-result colours overlapped: an unplayed kick was the exact hue of a
well-timed one. Identity now owns the cool half of the colour wheel and results
own warm-to-green, with no hue shared between them. The result chips and the
grade ramp were rebuilt onto the same rule.

**Link previews and an icon.** Shared links show a 1200×630 preview card; the
site has its own favicon, apple-touch icon and header mark, and a footer linking
the Mastodon profile.

**Fixes**

- The backing bass was silent on the first play on a device with nothing cached
  — its samples had not finished decoding and the notes were dropped. Lessons
  now wait for their own backing before starting, and warm it in the background
  on visit.
- The result screen showed a disabled _Next lesson_ button beside _Done_. The
  two are now alternatives: whichever applies, never a dead control.

### Internal

- `docs/LESSONS.md` — a how-to for managing lessons: adding a lesson or a stage,
  the pattern helpers, choosing a backing line, and what `make-lessons.py`
  enforces. The root `LESSONS.md` stays the index and `docs/curriculum.md` the
  rationale. `CLAUDE.md` symlinked to `AGENTS.md`.
- Google Analytics events for `lesson_started` / `lesson_finished` (lesson id)
  and `onboarding_started` / `onboarding_step` / `onboarding_finished` (step
  name). No practice data leaves the browser; these are counts of which lessons
  are opened and where setup is abandoned.
- `$lib/page-meta.svelte` and `$lib/site.ts` centralise per-page and site-wide
  link-preview tags, so no route can emit two `og:title`s.
- `warmKit` generalised to `warmUrls` with a `sampleUrl` builder, so backing
  samples warm the same fetch-only way drums already did.
- The `toot` CLI added to `devenv.nix` for Mastodon announcements.
- `scripts/render-og.sh` renders the preview card from `docs/og-card.svg`.
- Docs: a TODO scratchpad and a quotes collection.

## v0.0.1 — 7 August 2026

The launch. A free browser-based finger drumming trainer: lessons scroll down a
highway in time with a backing track, hits from MIDI pads are scored on timing,
and practice history is kept in the browser. No account, nothing to install.

See [the announcement](src/lib/news/2026-08-07-groove-academy-on-air.svelte) for
what shipped and what was still rough.
