# Groove Academy

A browser-based drumming trainer. Play along with interactive lessons to build
drumming skills, all in HTML — no native app required.

**The curriculum is written for finger drumming**, and that is what every lesson
teaches. But the instrument is not assumed: a pad grid and an electronic drum
kit are both first-class, and which one a student has is a property of their
**Controller** (see below), never a fork in the lessons.

## Stack

- SvelteKit (Svelte 5) + TypeScript
- Vite

## Routes

- `/lessons` — catalogue: one card per lesson (summary + pattern schematic). The
  schematic is `$lib/lesson-chart.svelte`, rendered from the lesson's own MIDI so
  it can't drift from what the highway plays.
- `/lessons/[id]` — one lesson. At rest the page is always brief → schematic +
  **Listen** → practice hints → **Play**; the scrolling highway only exists during
  a run, so finishing a lesson returns to the same page it started from.
  - **Listen** previews the lesson in place: drums and backing play off the audio
    clock with a playhead sweeping the schematic, nothing scored, no highway.
  - **Play** is the scored run — fullscreen highway, only the student's own hits
    make drum sounds, result report at the end.
  - Sound and Web MIDI come up on the first Play/Listen click (browsers need a
    gesture). MIDI access is never awaited: the permission prompt can stay pending
    indefinitely and must not hold up playback.
  - `?bpm=<40..240>` overrides the manifest tempo, e.g. `/lessons/1.2?bpm=90`.
    The effective BPM is shown next to Play and in the transport HUD.
  - A **tempo slider** (40–240) sits next to Play and is where the run's BPM comes
    from. It exists only on the resting page: scroll, scheduler and scoring all
    derive from `bpm`, so changing it mid-run would shift the segment the
    compositor is already animating. Moving it also stops a running Listen preview.
  - The slider's position is **remembered per lesson** in
    `localStorage["groove-master:bpm:<lessonId>"]`, so a lesson reopens at the tempo it
    was last practised at. Per lesson, never global — 1.1 at 120 says nothing
    about where 2.2 belongs. Precedence is `?bpm=` → remembered → manifest, and
    "reset" drops the remembered value so the lesson returns to its own tempo.
- `/stats` — practice history (see **Practice stats** below).
- `/onboarding` — setup wizard. `/debug/settings` — pad grid, device mapping, kit
  choice.
  - `/` redirects to `/lessons`. Debug pages (`/debug`, `/debug/controller`,
    `/debug/settings`, `/debug/levels`) are only linked from the top menu when
    `localStorage.debug` is set; they stay reachable by URL either way.
  - **`/debug/controller`** is the record, where every other view is
    interpretation: each pad with the note it listens for and the drum it fires,
    the hi-hat wiring, the transport bindings, plus a **live monitor** showing
    what `Controller.handle()` makes of each incoming message — the quickest way
    to tell a wrong mapping from a wrong picture. It exports and imports that
    record as JSON. **Import always re-targets**, because a mapping is keyed by
    the MIDI port id and browsers scope that per origin: the same kit is a
    different id on localhost and in production, so the id inside a file is
    ignored and you choose the device it lands on.
  - The wizard's last step captures the controller's **Play / Stop buttons**, so a
    lesson can be started and paused from the hardware. Both are optional and
    skippable. Buttons are not always notes — a transport section may send a CC or
    a single-byte System Real-Time (`0xFA`/`0xFC`), so the binding stores whatever
    the button emitted (`src/lib/transport-control.ts`) and `MidiHub.onMessage()`
    exposes the raw stream alongside `onNote()`. On `/lessons/[id]`, Start also
    resumes; Stop pauses, and ends the run on a second press.
  - **The wizard has three paths**, sharing their first two steps and branching
    once a device is chosen. `matchDevice()` in `$lib/presets.ts` decides between
    the last two, and the student can override it from the kit step. Past five
    steps the rail shows dots and names only the step you are on.
    - `connect · device · test` — a controller this machine already knows. It
      needs **proving, not re-mapping**: the stored mapping loads and the check
      names the pad _and_ the drum it plays, and sounds it. Re-map is one button
      from there and keeps everything but the notes.
    - `connect · device · grid · map · transport` — a pad grid.
    - `connect · device · kit · map drums · pedals · test · transport` — a kit.
  - **Feet are not asked for by hand.** Pads flagged `pedal` are excluded from the
    drum-capture loop — that loop says "hit the drum lit on the picture", which a
    foot does not do — and are captured on the pedals step instead. Bass pedal
    first, then the hi-hat's three gestures. **Each pedal is skippable on its own
    and the step as a whole is skippable**; owning the module without the
    footswitches is ordinary. What was skipped is stated, so a kick that will
    never sound is known before a lesson rather than during one.

## The Controller

**`$lib/controller.svelte.ts` is the student's instrument, and the facade over
everything it means.** No page parses a stored device config, and none of them
interpret raw MIDI. Read it before touching setup, scoring input, or the preview.

- One call does the interpreting: `handle(data)` returns a **hit** (with the GM
  note already resolved), a **pedal** movement, a **transport** press, an
  **unmapped** note, or **none**. `/lessons/[id]` is four lines and a switch.
- **Ordering inside `handle()` is load-bearing.** Pads are matched before
  transport, so a note bound to both still plays its drum; the pedal is matched
  after pads, so tapping the hat can't bind the hi-hat as its own pedal.
- It deliberately **does not debounce**. Pads bounce a note-on during _capture_,
  where the wizard filters them, but a run needs every hit — a 160 ms window
  would swallow 16ths at 120 BPM and quietly cost a roll.
- **Both kinds share one internal shape.** A grid's pads are synthesised with
  positional labels, so `kind` is consulted when _building_ a controller and
  essentially nowhere afterwards. Only `geometry` differs.
- **The pads are the source of truth**, and `notes` / `soundNotes` are
  regenerated from them on every save, so a reader that never learned this class
  still gets a working map. A stored config with no `kind` is a pad grid saved
  before the class existed and is read exactly as it always was — no migration,
  and nothing is rewritten on read.
- `canPlay()` / `missing()` are how `/lessons/[id]` says "your kit can't play
  this" _before_ a run, rather than letting open-hat notes surface as misses
  nobody can explain.
- `Controller.list()` names the controllers configured on this machine, so a
  chooser can describe one instead of repeating a MIDI port name.

### The hi-hat

A hi-hat is one drum with two voices, and kits disagree about how they say so —
which is why the pedals step **discovers** it from three gestures instead of
asking or assuming. Two notes is preferred wherever it is observed, because it
needs no state to be correct.

- `two-note` — open and closed send different notes. Both live on the _one_ pad
  (`note` / `altNote`), so the schematic still lights a single hi-hat.
- `stateful` — one note, and the pedal speaks for itself. Its position is
  tracked and the note resolves to closed (42) or open (46) at hit time.
- `none` — no usable pedal. One voice, and `canPlay` reports the gap.

Pedal traffic is **control, not performance**: it never sounds and never scores,
or every close would bank an extra note.

**A pedal at rest is open, and that is the trap.** Physically right, useless
here: the curriculum is overwhelmingly closed hats, so a student who just plays
scores nothing until they hold a footswitch down for a whole lesson — and it
fails _silently_, because the preview lights the hi-hat for either voice, so the
hits look like they landed. Hence `hihatPreference`: `/lessons/[id]` pins the hat
to whichever voice the lesson uses when it uses exactly one, and only the lessons
using both (`disco-open-hats`, `checkpoint-2`) leave the pedal in charge. The pin
is a bare GM note, so the Controller still knows nothing about lessons.

### The preview

`$lib/controller-preview.svelte` is the only thing that draws pads. It absorbed
`controller-map.svelte` and `pad-grid.svelte`, which drew the same pads without
knowing whose they were. Geometry comes from `controller.geometry` — a grid, a
profiled kit's schematic, or the neutral arrangement — so the caller never picks
a renderer, and three modes sit over that same geometry: **capture** (wizard),
**map** (beside the lesson chart), **play** (during a run).

- During a run the highway is `position: fixed; inset: 0` with the lanes banded
  across its middle, so the preview's room is the empty half _below the band_,
  not space in the flow — of which there is none. `laneH` knows nothing about
  the preview, which is what makes "the highway is sized first" true rather than
  merely intended. In the full view there is never room.
- Animation is decoration over state that colour already carries, so all of it
  stops under `prefers-reduced-motion` and nothing becomes unreadable.

### Kit profiles

`KIT_PROFILES` in `$lib/presets.ts` describes a _model_; a Controller describes a
_student's instrument_. A profile therefore carries geometry, drum roles and
suggested sounds — and **never a MIDI note**, because a module's pads are
reassignable from its own front panel.

- Each profile points at `static/kits/<id>.svg`, whose drums are `<g id>`s
  matching its pad ids. The asset is **geometry only** — no fills or strokes —
  and the preview owns every bit of appearance, so it reads the same in either
  theme.
- The preview **inlines** that SVG to mark drums by id, so only first-party files
  under `static/kits/` are ever loaded this way. A submitted layout never
  becomes one.
- `scripts/check-kits.py` fails **`pnpm check`** if a pad id has no drum in the
  schematic, or a drum has no pad — drift there breaks the wizard and the lesson
  page at once, and silently. It is deliberately **not** in `pnpm build`:
  `.vercelignore` excludes `scripts/`, so a build gated on it dies on the deploy
  host with a missing-file error. Authoring checks belong where authoring
  happens.

### Sharing a layout

After a **generic** setup (a kit with no profile), the student may send the
layout so it can become a shipped profile. Opt-in, one shot, works signed out,
and the setup is saved either way. It goes to `device_layouts`, which is
**insert-only with no select policy for anyone** — a write-only mailbox emptied
by hand, not a catalogue the app reads back. Not offered when no Supabase is
configured.

## Drum samples

- `soundfonts/Perfect_Drums.sf2` holds 12 GM-percussion kits (244 MB, not shipped
  to the browser).
- `python3 scripts/render-drums.py` pre-renders each kit's drums to
  `static/drums/kit<N>/<note>.oga` plus `static/drums/manifest.json`
  (kits + drum catalogue). Re-run after changing the SoundFont or layout.
- **Some GM notes have no key zone in the .sf2**, and fluidsynth renders those as
  five seconds of silence while still exiting 0 — a pad that decodes fine and
  plays nothing. So the script audits every render and fills silent ones from its
  `FALLBACKS` table (a stand-in from another kit, or a neighbour note resampled
  with ffmpeg); it exits non-zero if any file is still silent. Currently notes 39
  (kits 7-12), 47 and 68 are covered this way.
  - `audit-samples` (`--audit`) lists silent samples — no SoundFont needed.
  - `repair-samples` (`--repair`) substitutes them in place; needs ffmpeg, but
    still no SoundFont, so the shipped assets can be fixed without the 244 MB .sf2.
- Sample levels in this SoundFont are uneven (-33 to -7.5 dBFS across a kit), so
  when choosing a stand-in, match the level of its neighbours on the grid, not
  just the nearest pitch.
- **Level trims** are baked into the `.oga` files, not applied at playback. The
  `LEVELS` table (kit → note → dB) in `render-drums.py` is the source of truth;
  `static/drums/levels.json` records what is already baked in, so `--level`
  applies only the difference and re-running is a no-op. Audition trims on
  `/debug/levels` and paste its JSON export into `LEVELS`.
  - Every change re-encodes, so once a set of trims settles, do a full render to
    bake them in one pass instead of stacking Vorbis generations.
  - `--level` refuses a trim that would clip (peak + gain > -0.5 dBFS).
- The grid uses two mappings: **controller note → cell** (Capture) and
  **cell → GM drum note** (per-cell dropdown). Both are saved per device in
  `localStorage`, through the Controller.
- `/debug/settings` hard-codes sixteen cells, so it **refuses a drum kit** rather
  than flattening one into a 4×4 grid on save. Editing a kit lives in the wizard,
  which knows what the drums are.

## Sample caching

- `src/service-worker.ts` caches `**/*.oga` cache-first, so samples are kept on
  the user's machine and a kit switch is instant after the first visit. The audio
  is _not_ precached (~10 MB); `serviceWorker.files` in `vite.config.ts` keeps it
  out of the `$service-worker` manifest.
- `warmKit()` in `$lib/drums.ts` pulls the saved kit (~700 KB) into that cache
  from `+layout.svelte` on idle, skipping anything already stored. It waits for
  the worker to control the page first — on a first visit the document loads
  before the worker exists, and fetches made before `clients.claim()` bypass it
  and are downloaded for nothing.
- Samples live at stable URLs, so a re-render or re-level only reaches people
  when the version-keyed cache is replaced on activate — cache-first is immune
  to `cache: 'reload'`. A one-shot fetched with any query string skips the cache
  entirely; that is how `/debug/levels` measures what is really on disk. Verify with
  `pnpm build && pnpm preview`; in dev `build` is empty so only the runtime
  audio caching is exercised.

## Lessons

- **[`docs/LESSONS.md`](docs/LESSONS.md) is the how-to** — adding a lesson or a
  stage, the pattern helpers, choosing a backing line, what the driver checks.
  Read it before touching `scripts/lessons/`. The rest of this section is the
  summary.
- The curriculum is **stage → module → lesson**, and a module is always exactly
  three lessons: `plain` (the technique alone), `core` (its normal musical
  form), `stretch` (its hardest useful variation). `LESSONS.md` is the
  lesson-by-lesson index; `docs/curriculum.md` is why the order is what it is.
- A lesson's **id is its slug** (`kick-quarters`) and never changes. The
  displayed `2.4` is `number`, rendered from position, so inserting a lesson
  renumbers the catalogue without orphaning a student's practice history or a
  remembered tempo. Old numeric ids map to slugs via `LEGACY_IDS` in
  `$lib/stats.ts`, applied on read.
  - **Stages are numbered within their tier** — every tier restarts at Stage 1,
    so the stage part of a lesson number is tier-local. A stage still carries a
    stable global `number` (used only to map it to its tier and name its MIDI
    directory) plus a `tierNumber` the catalogue displays; `make-lessons.py`
    derives `tierNumber` from the stage's position among its tier's stages.
  - The four **tiers** (Foundations…Mastery) are declared in
    `scripts/lessons/__init__.py` (`TIERS`) — slug, orienting question, and the
    global stage numbers each owns — and emitted to the manifest. `tier` and
    `stage` are reserved lesson slugs so they can't shadow the catalogue's
    `/lessons/tier/…` and `/lessons/stage/…` routes.
- `python3 scripts/make-lessons.py` writes the MIDIs and
  `static/lessons/manifest.json`. It is only a driver: the curriculum lives in
  `scripts/lessons/`, one module per stage (`stage01_pulse.py`, …), each
  exporting a `STAGE` built from `lessons/schema.py`. Shared code sits in
  `midi.py` (bytes), `grids.py` (patterns as beat offsets) and `bass.py`.
  Patterns and their prose live side by side in the stage file.
- MIDIs go to `static/lessons/stage-NN-<stage>/<slug>.mid` — **filenames carry
  the slug only, never a number**. Order lives in the manifest and nowhere else.
  The driver rebuilds the tree on every run, so a renamed lesson cannot leave a
  stale file behind.
- A designed-but-unwritten slot is a `planned()` entry: it holds its number and
  renders greyed out in the catalogue, so the road ahead is visible and filling
  it in later shifts nothing.
- Each written lesson needs `slug`, `name`, `tier`, `bpm`, `bars`, drum/bass
  pattern builders, a one-line `summary` (catalogue card), a longer
  `description`, and `hints` — the practice tips listed under the schematic.
- Every stage ends in a `checkpoint()`: one bar of each pattern from that stage.
  Practising one pattern until it is smooth retains poorly; interleaving
  competing patterns retains far better, so the checkpoint is where a stage is
  actually passed.
- **The backing bass is a scaffold and must fade.** `bass.py` orders them by how
  much they help — `QUARTER` doubles the pulse, `OCTAVE` bounces, `SYNCOPATED`
  pushes against the student. A module opens on `QUARTER` and a stage ends on
  something that no longer helps.
- Hints must not tell the student to change tempo. The manifest BPM is the tempo
  the lesson is written for; the slider and `?bpm=` are the student's own call,
  not something the lesson text should direct.
- **Every lesson ends ON the next bar line**, not a beat before it: whatever
  sounds on beat 0 sounds once more on the down-beat after the last bar, and the
  bass resolves onto the tonic on that same beat. The closing hit is scored, so
  `parseMidi` runs the transport `TAIL_BEATS` past the last note — otherwise it
  would fall outside its own match window and count as a miss however well it
  was played.
- **A lesson with no hi-hat of its own borrows one**: a `guide` track of closed
  8ths at low velocity, audible on the lesson's kit but never shown or scored,
  added by `build_lesson()` only when the pattern has no hat. Without it the
  student is counting in silence between their own hits.
- **Every lesson counts in**: three side-stick clicks on the last three beats of
  the lead-in bar, with the pattern's first beat left silent for the student. It
  ships as a `count-in` track in each MIDI, written in the lead-in bar the
  highway already had; `parseMidi` shifts it to beats -3, -2, -1 and keeps it out
  of the lanes, the chart and the scoring. `build_lesson` adds it to every
  lesson, so new entries get it for free. Play counts in; Listen skips it.

## Practice stats

- Every **scored run** is appended to IndexedDB (`groove-master` / `sessions`) from
  `finish()` on `/lessons/[id]`. Listen previews and abandoned runs are not
  recorded — only a lesson played to the result screen. `$lib/stats.ts` owns the
  schema and is non-throwing by contract: a browser with no IndexedDB still plays
  lessons, it just records nothing.
- A record carries the lesson, the **BPM actually played**, the **controller**
  (live Web MIDI port name + id, `null` when nothing was connected), the note
  counts (perfect/good/off/miss/extra), the ms stats (`avgAbsMs`, early/late),
  `durationMs`, and the per-pad breakdown.
  - `durationMs` is derived from the run's length in beats at its BPM, not from
    the wall clock, so a pause mid-lesson is not banked as practice time.
  - `day` (local `YYYY-MM-DD`) is stored rather than derived on read: the heatmap
    buckets by the day the student experienced, and a run finished at 00:30 local
    is the previous day in UTC.
- `/stats` reads the log and aggregates **per local day**. A GitHub-style 53-week
  heatmap answers "am I showing up"; four `$lib/trend-chart.svelte` charts (tempo,
  timing error, accuracy, time played) answer "am I improving", sharing one range
  filter so they always describe the same slice.
  - The range control is **one row above everything it scopes** — tiles, trends,
    controllers and the run table all read the same slice. The heatmap is the
    deliberate exception: it is how you reach a day, so scoping it would strand
    you. The day streak is the other, being a property of the whole history.
  - Alongside `30d/90d/1y/All` sits **Day**. Clicking a heatmap cell — or a point
    on any trend — scopes the whole page to that day in place; nothing navigates.
    The chip then carries the date with ‹ › arrows that step to the nearest
    _practised_ day, not the next calendar one, so a holiday is one click rather
    than fourteen.
  - In day mode the trends re-grain: a day aggregated per day is one point, so
    the x axis becomes that day's **runs** and its labels become clock times.
    Points stop being selectable — a run has nothing further to drill into — and
    the **single-day panel** (that day's runs one by one, plus the pads folded
    across them) stands in for the recent-runs table.
  - Both the heatmap and the selectable charts are **one tab stop with a roving
    focus**, not one per mark — arrows move, Enter opens, Escape closes. On the
    charts the interaction lives on a transparent `<button>` laid over the plot,
    so the role stays static and focus/Enter/Space come from the platform.
  - **One series per chart, deliberately.** The four measures have unrelated
    scales; overlaying them would mean a second y-axis. Add a chart, never an axis.
  - Chart hues come from the `--gold` / `--cyan` / `--green` / `--violet` tokens,
    validated for CVD separation and contrast against `--surface`. The heatmap
    ramp is one hue in four steps; its empty cell is a ringed "no data" swatch,
    not a fifth step.

## Bass samples (backing track)

- Three CC0 (public-domain) FreePats basses live in `soundfonts/`
  (`LatelyBass.sf2`, `SynthBass1.sf2`, `SynthBass2.sf2`).
- `python3 scripts/render-bass.py` renders notes E1–C4 (MIDI 28–60) to
  `static/bass/<id>/<note>.oga` plus `static/bass/manifest.json`.
- **Any SoundFont whose samples are shipped must be credited in `THANKS.md`**
  (name, samples taken, license, authors).

## Quote of the Day

- Between lessons — pressing **Next lesson** on a scored run's result screen —
  `$lib/quote-of-the-day.svelte` shows one random drummer/producer quote
  full-screen; the author's name reveals its testimonial on hover/click/focus,
  and a **like/dislike** (or the **never show quotes** checkbox) advances to the
  next lesson. Navigation stays on the lesson page; the component only signals
  `onAdvance`.
- `docs/groove_academy_quotes.csv` is the editorial source.
  `python3 scripts/make-quotes.py` converts it to `static/quotes/quotes.json` —
  **re-run after editing the CSV**. Each quote's id is
  `<author-slug>-<8-hex citation hash>`, stable across adds/reorders and tied
  only to the citation text.
- Selection **prefers unseen quotes**; once every quote has been shown the cycle
  restarts. Seen set, the "never show" opt-out, and ratings live in
  `localStorage` via `$lib/quote-store.ts` (offline-first, best-effort like
  `progress-store.ts`).
- **Ratings are device-local; cloud sync is designed but not wired.** The
  owner-scoped `quote_ratings` table exists (RLS keyed to `auth.uid()`, migration
  applied) and `quote-store.ts` shapes a rating to match its row, but there is no
  `syncRatings` in `$lib/sync.ts` and `reconcile()` does not touch ratings. When
  it is wired: unlike progress (monotonic) and stats (append-only) a rating can
  change, so the merge is **last-write-wins by `updated_at`**. The feature works
  either way, and works with no Supabase configured at all.

## Link previews

- A page's title and description go through `$lib/page-meta.svelte`, which emits
  `<title>`, `og:title`, `og:description`, `og:url` and `rel=canonical` together.
  **Don't hand-write those in a page's `<svelte:head>`** — the layout already
  emits the constant half (site name, card type, image, `twitter:card`), and a
  second `og:title` anywhere in the head wins or loses by document order.
- Absolute URLs come from `SITE_URL` in `src/lib/site.ts`. They have to be
  absolute: every crawler drops a relative `og:image`, and `base` is relative
  during SSR. Change that constant if the domain moves.
- `static/og.png` is the 1200x630 card. Edit `docs/og-card.svg` and re-run
  `scripts/render-og.sh` (headless Chrome — qlmanage, which rendered the
  favicons, only makes square thumbnails).
- `/lessons/[id]` fetches its manifest in `onMount`, so a crawler sees the
  generic fallback rather than the lesson's own name. Naming it would mean
  moving that fetch into a `+page.ts`.

## Releases

A release is three artefacts that must agree: an annotated **tag**, a
**CHANGELOG.md** entry, and a **news post** under `src/lib/news/`. The changelog
is the complete list (user-facing _and_ internal); the news post is the readable
half, written as prose for someone who practises here and does not read commits.
Versions are `vX.Y.Z`, tagged from `main`.

The whole thing is a negotiation, not a script: draft, show the user, adjust,
and only then commit, push and announce. Never tag, push or toot without asking.

1. **Pick the version.** `git describe --tags --abbrev=0` for the previous one,
   then ask the user which part to bump — the answer decides what the release is
   called, so it comes first even though the tag itself is created last.
   `package.json`'s `version` is _not_ maintained; the tag is the version of
   record.
2. **Read the range.** `git log --oneline <prev>..HEAD` plus the diffs behind
   anything unclear. Sort it into user-facing and internal by one test: _would
   you notice this while practising?_ A refactor with no audible or visible
   effect is internal however large it was.
3. **Draft both texts** and show them to the user together — the changelog entry
   (`## vX.Y.Z — D Month YYYY`, then `### User-facing` / `### Internal`,
   newest-first at the top of the file) and the news post. Expect to revise;
   the user's edits to the prose are the point of this step.
4. **Take the screenshots** (see below) for whatever in the post is visual, and
   place them in the draft before the user reviews it — a post is judged with its
   pictures in, not as prose plus a promise of pictures.
5. **Commit** the changelog, the post and its images, then **tag** that commit:
   `git tag -a vX.Y.Z` with a message that opens `vX.Y.Z — <the release's name>`,
   a short paragraph, a bulleted digest of the user-facing half, and a pointer to
   `CHANGELOG.md`. Tagging after the commit is deliberate — the tag has to
   contain its own release notes.
6. **Push** commit and tag (`git push && git push origin vX.Y.Z`) once the user
   agrees. Vercel builds `main` on push.
7. **Wait for it to be live and check**, don't assume: fetch
   `https://groove.academy/news/<slug>` until it answers 200 with the post's
   title in it. A deploy that failed looks exactly like one that has not
   finished yet.
8. **Announce on Mastodon** — draft the toot, show it to the user, amend, and
   post only after explicit confirmation. `toot post` (the CLI is in
   `devenv.nix`). **Check `toot auth` before posting**: announcements go out as
   `@groove_academy`, and the active account may well be a personal one. Keep it
   to a few lines of what changed and the post's URL; the news page carries the
   detail. Link the permalink, not the root, so the toot stays accurate after the
   next release.
   - **Always hashtags.** The core set is
     `#fingerdrumming #drums #drumpractice #midi`, plus what the release is
     about — `#drumming #learndrums` for a curriculum release,
     `#edrums #electronicdrums #webmidi` for a hardware or setup one. Drumming
     tags only: a genre tag like `#reggae` lands on a timeline with no interest
     in a drum trainer. Tags are how the account is found at all, so a release
     announced without them reaches the people who already follow it and nobody
     else.
   - **A visual release gets a picture**, by the same rule the news post follows.
     Reuse one of the post's figures rather than shooting a new one, and carry
     its alt text across: `toot post -m <file> -d <alt>`.
   - **Both belong in the draft shown for approval**, not bolted on afterwards.
     `toot` has no `edit` command, so correcting a posted toot means going at the
     API directly (`PUT /api/v1/statuses/:id`, media uploaded first via
     `POST /api/v2/media`) or deleting and reposting under a new URL.

**The version number never appears in an announcement.** Not in the toot, not in
the news post, not in its title or summary. A version tells a drummer nothing —
"Bring your kit" is the news, "v0.0.4" is bookkeeping — and leading with it
buries the change behind a number that only means something to whoever cut the
release. The version is internal: it lives in the annotated tag and in
`CHANGELOG.md`, which are the release's own record, and nowhere a reader looks.

### News posts

- One entry per release in `NEWS` in `src/lib/news/index.ts`, newest first, with
  the body as its own `YYYY-MM-DD-slug.svelte` beside it. The file-level comment
  there is the authoring contract — most importantly a **published slug never
  changes**, because it has been shared and indexed; titles are free to correct.
- A post opens with a paragraph saying what the release is _about_, then an `h3`
  per change. Write what the student gains and, where it helps, what was wrong
  before — "you were counting in silence between your own hits" lands where "a
  guide hi-hat track was added" does not. Internal work does not appear at all.
- The body receives `mastodon` as a prop, so the handle is written once; close on
  a link to it and a link back into `{base}/lessons`.
- The listing and the link preview read `title` and `summary` from the index and
  never render the body, so a `summary` that drifts from the post is invisible
  until someone shares the link.

### Screenshots

**A release post about something you can see gets a picture of it.** Most of what
ships here is visual — a highway, a chart, a result screen — and one screenshot
settles what a paragraph can only describe. Prose-only is for a release with
nothing to show.

- Shoot the **real app**, never a mock-up: `pnpm dev`, then drive the page with
  the Chrome DevTools MCP tools (`navigate_page`, `resize_page`,
  `take_screenshot`). Get the app into the state being announced first — start a
  run for the highway, play a lesson through for the result screen — because a
  screenshot of an empty page is what makes a post feel like documentation.
- Save to `static/news/<slug>/<name>.png` — same slug as the post, so the images
  are as permanent as the URL that shows them and are never orphaned by the next
  release. Reference them absolutely from `base`: `src="{base}/news/<slug>/…"`.
- **Shoot near the width the figure is displayed at, not bigger.** A post's
  column is 40rem, and an image fills it at `width: 100%` — so a 1280px-wide
  screenshot lands at roughly half scale and its body text becomes unreadable.
  Around **840px wide** keeps type legible; shoot a wide layout narrower rather
  than shrinking it. Use one width for every figure in a post.
- Set the viewport height to the content instead of cropping afterwards: a short
  viewport is the crop. It also overflows, so hide the scrollbar
  (`document.documentElement.style.overflow = 'hidden'`) or it shows up as a
  stripe down the edge of the figure. macOS has no `ffmpeg` outside the devenv
  shell and `sips` only crops from the centre, so cropping is the harder path.
- Every image is a `<figure>` with real `alt` text and a `<figcaption>`. The alt
  describes what is in the picture for someone who cannot see it; the caption
  points at what to notice. `$lib/news-article.svelte` styles both — a post
  should never carry its own image CSS.
- Keep them out of the way of weight: PNG for UI (it is flat colour and
  compresses well), and check the total the post adds. These ship in `static/`
  and are downloaded by everyone who opens the feed.

## Commands

- `pnpm dev` — start dev server
- `pnpm build` — production build
- `pnpm preview` — preview the production build
- `pnpm check` — type-check with svelte-check
