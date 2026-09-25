# edrum-setup

## MODIFIED Requirements

### Requirement: Capture drums on the schematic

The MIDI flow SHALL capture one pad at a time by highlighting it on the chosen
geometry and recording the next distinct note received, marking it captured and
advancing to the next pad.

Repeated note-on messages from a single strike SHALL NOT be recorded as separate
pads.

The student SHALL be able to skip a pad, re-record any already-captured pad,
finish early once at least one pad is mapped, and restart the capture, without
leaving the step. **These controls SHALL be available for every geometry.** A
student whose instrument cannot produce a note for every pad the geometry
describes SHALL always be able to finish, and SHALL never be left with no way
forward but to restart or go back.

A pad that is skipped SHALL be left unmapped rather than assigned a placeholder
note.

Capture SHALL audition the **drum** the pad is mapped to, for every geometry. It
SHALL NOT play a melodic tone in place of a drum: the instrument being configured
is a drum kit however its pads are arranged, and a student who hears no drum
during setup has not confirmed anything about the sound they will practise with.

Where a captured note is itself a General MIDI percussion note **and the
instrument is a drum module**, it SHALL be adopted as that pad's sound, because a
module that names its own pads in GM is a better source than any suggestion
written from a photograph.

This SHALL NOT be done where the instrument's profile declares that its notes
carry **no GM drum meaning**. A module may send notes inside the GM percussion
range that name entirely different instruments than the pads play — a pad
sending 50 ("High Tom") while playing a kick — so adoption would assign the wrong
drum to every pad at once, and would do so most confidently where the profile is
most certainly right. The profile's own sounds SHALL stand instead.

This SHALL NOT be done for a **grid** geometry. A grid's note numbers are not a
claim about drum identity — they are typically one chromatic run in which the
number means only "which pad", so adopting them would overwrite the grid's own
layout, which deliberately places kick, snare and hats within reach. A grid whose
pads send 48 upward would otherwise end up with no snare at all.

#### Scenario: A kit is mapped drum by drum

- **WHEN** the student hits the pad highlighted on the geometry
- **THEN** that pad's note is recorded and the pad is marked captured
- **AND** the next pad is highlighted

#### Scenario: A pad the kit does not have is skipped

- **WHEN** the student skips the highlighted pad
- **THEN** that pad is left unmapped
- **AND** the layout is saved with the remaining pads intact

#### Scenario: One strike is one capture

- **WHEN** a pad sends more than one note-on for a single strike
- **THEN** only one pad is captured

#### Scenario: A grid geometry can be finished early

- **WHEN** the student has mapped at least one pad of a grid geometry and chooses to finish
- **THEN** the flow continues to the next step with the pads mapped so far
- **AND** the unmapped pads are left unmapped

#### Scenario: A grid geometry can skip a pad

- **WHEN** the student's controller produces no note for a pad the grid describes
- **THEN** they can skip it and continue

#### Scenario: Capture sounds a drum, not a tone

- **WHEN** a pad is captured on any geometry with capture sound enabled
- **THEN** the drum that pad is mapped to is sounded

#### Scenario: A module's own GM note is adopted as the sound

- **WHEN** a drum module's captured note is a General MIDI percussion note
- **AND** its profile does not declare that its notes lack GM meaning
- **THEN** it becomes that pad's sound, overriding the profile's suggestion

#### Scenario: A kit whose notes carry no GM meaning keeps its profile's sounds

- **WHEN** a kit whose profile declares its notes carry no GM drum meaning is captured
- **AND** the captured notes fall inside the General MIDI percussion range
- **THEN** each pad keeps the sound its profile supplied
- **AND** the kick, snare and hi-hats the profile describes are all playable

#### Scenario: A grid keeps its own layout

- **WHEN** a grid geometry is mapped from a controller sending a chromatic run of notes
- **THEN** each pad keeps the drum the grid layout assigned it
- **AND** the kick, snare and hats the layout provides are all still playable
