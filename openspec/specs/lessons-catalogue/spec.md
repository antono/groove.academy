# lessons-catalogue Specification

## Purpose

TBD - created by syncing change lessons-layout. Update Purpose after archive.

## Requirements

### Requirement: Tier landing

The catalogue landing at `/lessons` SHALL present only the curriculum's tiers —
one entry per tier — and no stages, modules or lesson cards. Each tier entry
SHALL show the tier's name and its orienting question, both read from the
manifest's `tiers` metadata.

#### Scenario: Landing lists tiers only

- **WHEN** a student opens `/lessons`
- **THEN** the page shows one entry per tier with its name and orienting question
- **AND** no stage headings, module headings or lesson cards are rendered at this level

#### Scenario: Tier text comes from the manifest

- **WHEN** the landing renders a tier entry
- **THEN** its name and question are taken from the manifest `tiers` metadata, not hard-coded in the app

#### Scenario: A tier with no written stages is shown but not navigable

- **WHEN** a tier's stages are all absent from the manifest or contain no written lessons
- **THEN** the tier entry is shown in a locked style consistent with unwritten (`planned`) material
- **AND** it is labelled as not yet available rather than gated on the student's progress
- **AND** activating it does not navigate

### Requirement: Drill-down navigation

The catalogue SHALL be navigated as three levels — tier landing, tier view, stage
view — each on its own route, showing exactly one level of the tier → stage →
lesson hierarchy. A lesson SHALL continue to open at its existing
`/lessons/<slug>` URL.

#### Scenario: Landing to tier view

- **WHEN** a student activates an available tier on the landing
- **THEN** they navigate to that tier's view at `/lessons/tier/<tier-slug>`
- **AND** it lists that tier's stages and nothing from other tiers

#### Scenario: Tier view to stage view

- **WHEN** a student activates a stage in a tier view
- **THEN** they navigate to that stage's view at `/lessons/stage/<stage-slug>`
- **AND** it shows that stage's modules and their lesson cards

#### Scenario: Stage view to lesson

- **WHEN** a student activates a lesson card in a stage view
- **THEN** they navigate to that lesson at `/lessons/<slug>`
- **AND** the lesson URL does not encode the tier or stage

#### Scenario: Each level is a shareable URL with working history

- **WHEN** a student opens a tier or stage URL directly, or uses the browser back button
- **THEN** the corresponding level renders on its own
- **AND** the back button returns to the level they came from

### Requirement: Breadcrumbs

Every level below the landing SHALL show breadcrumbs at the top of the page —
before the level's heading and orienting text — tracing the path from Lessons
down to the current level. Each ancestor crumb SHALL link to its level.

#### Scenario: Breadcrumbs on the stage view

- **WHEN** a student is on a stage view
- **THEN** breadcrumbs read `Lessons › <Tier> › <Stage>` at the very top of the page, above the heading
- **AND** `Lessons` and `<Tier>` are links to the landing and the tier view respectively

#### Scenario: Landing has no breadcrumbs

- **WHEN** a student is on the landing
- **THEN** no breadcrumb trail is shown, because it is the root of the hierarchy

### Requirement: Orienting text per level

Each level SHALL surface the goal text authored for that level so a student
always knows what the level is for: the tier's question on the tier view, the
stage's goal on the stage view, and each module's subtitle above its lessons.

#### Scenario: Tier view states the tier's goal

- **WHEN** a student opens a tier view
- **THEN** the tier's orienting question is shown near the top

#### Scenario: Stage view states the stage's goal and module subtitles

- **WHEN** a student opens a stage view
- **THEN** the stage's goal is shown near the top
- **AND** each module's subtitle is shown above that module's lesson cards

### Requirement: Progress rollups

The landing and tier view SHALL show, per tier and per stage, how much of the
written material the student has cleared, aggregated at read time from practice
history. Unwritten (`planned`) lessons SHALL be excluded from the totals.

#### Scenario: Stage rollup reflects cleared written lessons

- **WHEN** a stage has N written lessons and the student has cleared C of them
- **THEN** the tier view shows that stage's progress as C of N
- **AND** planned lessons in that stage are not counted in N

#### Scenario: Rollups without practice history

- **WHEN** the browser has no practice history or IndexedDB is unavailable
- **THEN** every rollup renders as empty progress
- **AND** navigation still works

### Requirement: Roadmap visualization

The catalogue SHALL show a visual journey spine that lays out the tier → stage
path and marks the student's current position, so location is conveyed beyond
breadcrumbs. Each node's fill SHALL reflect the same progress rollup data.

#### Scenario: Spine marks the current position

- **WHEN** a student is within a given tier or stage
- **THEN** the journey spine marks that tier/stage as the current position
- **AND** each tier/stage node shows its progress as a fill

#### Scenario: Spine renders the road ahead

- **WHEN** later tiers or stages have no written lessons yet
- **THEN** the spine still shows them as upcoming nodes, so the full path is visible

### Requirement: Continue shortcut

The landing SHALL offer a shortcut that takes the student directly to their next
lesson without drilling through the hierarchy. The target SHALL be the first
written, non-`planned` lesson in curriculum order that the history does not mark
cleared; if every written lesson is cleared, it SHALL be the last written lesson.

That target SHALL additionally be reachable at a stable URL, `/lessons/continue`,
which resolves it and takes the student to that lesson. The URL exists so that a
destination fixed in advance — an installed app's shortcut, a bookmark, a shared
link — can point at "my next lesson" even though the target is derived from
practice history held on the device. The landing's shortcut and the URL SHALL
resolve to the same lesson, so there is one definition of continuing.

Resolution SHALL happen on the device that holds the history. Where the target
cannot be resolved — the catalogue is unavailable — the student SHALL be taken
to the catalogue landing rather than shown an error.

#### Scenario: Continue jumps to the next uncleared lesson

- **WHEN** a student activates the continue shortcut on the landing
- **THEN** they navigate straight to the first written lesson in curriculum order not marked cleared

#### Scenario: Continue with no history

- **WHEN** there is no practice history
- **THEN** the continue shortcut targets the first written lesson

#### Scenario: The continue URL resolves to the same lesson

- **WHEN** a student opens `/lessons/continue`
- **THEN** they arrive at the same lesson the landing's continue shortcut would have taken them to

#### Scenario: The continue URL with no history

- **WHEN** a student opens `/lessons/continue` on a device with no practice history
- **THEN** they arrive at the first written lesson

#### Scenario: The continue URL when the catalogue cannot be read

- **WHEN** `/lessons/continue` is opened and the catalogue cannot be loaded
- **THEN** the student arrives at the catalogue landing rather than an error page

#### Scenario: Continue does not accumulate in history

- **WHEN** a student opens `/lessons/continue` and then goes back
- **THEN** they return to where they came from rather than to the resolver

### Requirement: Lesson cards unchanged

Within a stage view, each lesson SHALL be presented with the same card as before
the tier change — the MIDI-derived schematic, the summary, the earned/tempo
badges, and the greyed treatment for `planned` slots — regrouped under their
module headings.

A card SHALL additionally carry a **marker** where the lesson demands more
simultaneous hits than the active instrument's voice count allows, stating what
would unlock it. The marker SHALL be distinguishable from the greyed treatment a
`planned` slot receives: a planned lesson does not exist yet, whereas this one
exists and is merely out of reach on today's instrument.

A marked lesson SHALL remain openable and playable. Marking SHALL depend on the
active instrument, so the same lesson may be marked on one and not on another,
and SHALL disappear when the instrument gains the voices.

No other lesson-card behaviour SHALL change.

#### Scenario: Card content is preserved

- **WHEN** a written lesson appears in a stage view
- **THEN** its card shows the schematic, summary and earned/tempo badges as before
- **AND** a planned slot appears greyed in its module position

#### Scenario: A lesson beyond the instrument is marked

- **GIVEN** an active controller with a voice count of two
- **WHEN** a lesson requiring three simultaneous hits appears in a stage view
- **THEN** its card carries the marker and states what would unlock it
- **AND** the lesson remains openable

#### Scenario: The marker follows the instrument

- **GIVEN** a lesson marked on a two-voice instrument
- **WHEN** the student makes a three-voice instrument active
- **THEN** the marker is gone

### Requirement: Manifest tier metadata

The lesson manifest SHALL carry a top-level `tiers` declaration — each tier with
a slug, name, orienting question, and the stages it contains — generated
additively without changing MIDI, lesson patterns, or lesson order. The app
SHALL treat `tiers` as optional and degrade gracefully if it is absent.

#### Scenario: Tiers are declared in the manifest

- **WHEN** the manifest is generated
- **THEN** it includes a `tiers` array mapping each tier to its stages, name and question
- **AND** no MIDI file or lesson order is changed by adding it

#### Scenario: Stale manifest without tiers

- **WHEN** the app reads a manifest that has no `tiers` field
- **THEN** it still renders the catalogue, grouping stages under a single untitled section rather than failing

### Requirement: Tier-local stage numbering

Stages SHALL be numbered within their tier, each tier restarting at Stage 1, and
the catalogue SHALL display that tier-local number. The stage part of a lesson's
displayed number SHALL be tier-local to match. A stage SHALL retain a stable
global identifier used only to map it to its tier and name its files; changing
the display numbering SHALL NOT change any lesson slug or stored history.

#### Scenario: Each tier restarts at Stage 1

- **WHEN** a tier's stages are shown
- **THEN** the first stage of every tier is displayed as Stage 1, the next as Stage 2, and so on
- **AND** a stage's displayed number counts only the stages present in its own tier

#### Scenario: Lesson numbers follow the tier-local stage number

- **WHEN** a lesson card is shown
- **THEN** the stage part of its number matches the tier-local number of its stage

#### Scenario: Renumbering does not touch identity

- **WHEN** the display numbering changes
- **THEN** no lesson slug changes and no practice history or remembered tempo is affected

### Requirement: Reserved navigation slugs

The lesson generator SHALL reject `tier`, `stage` and `continue` as lesson
slugs, so the static navigation routes can never be shadowed by a lesson at
`/lessons/<slug>`.

#### Scenario: A lesson slug cannot collide with a route segment

- **WHEN** a lesson is defined with the slug `tier`, `stage` or `continue`
- **THEN** generation fails with an error naming the reserved slug

### Requirement: Legacy landing redirect

Requests to the old flat catalogue URL SHALL resolve to the new tier landing.
No attempt SHALL be made to preserve deep links to a stage by scroll position.

#### Scenario: Old catalogue link resolves to the landing

- **WHEN** a student opens a previously shared `/lessons` link
- **THEN** they arrive at the tier landing

### Requirement: Manifest voice requirement

The lesson manifest SHALL carry, per lesson, the largest number of **scored**
hits that fall on one instant.

It SHALL be derived by the generator from the same pattern data the lesson's
MIDI is written from, so it cannot drift from what the highway plays. It SHALL
NOT be authored by hand.

Notes that are not scored SHALL be excluded from the count: the borrowed guide
hi-hat, the count-in, and the backing bass are not hits the student plays.

The app SHALL treat the field as optional and degrade gracefully if absent,
marking nothing rather than failing.

#### Scenario: The count is generated with the lesson

- **WHEN** the manifest is generated
- **THEN** each written lesson carries its maximum simultaneous scored hit count
- **AND** no MIDI file or lesson order is changed by adding it

#### Scenario: Unscored tracks do not inflate the count

- **WHEN** a lesson carries a guide hi-hat, a count-in and a bass line
- **THEN** none of them contribute to the count

#### Scenario: A manifest without the field

- **WHEN** the app reads a manifest whose lessons carry no voice requirement
- **THEN** the catalogue renders and no lesson is marked
