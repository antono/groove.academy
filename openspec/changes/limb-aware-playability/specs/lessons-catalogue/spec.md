# lessons-catalogue

## ADDED Requirements

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

## MODIFIED Requirements

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
