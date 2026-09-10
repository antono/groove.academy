## ADDED Requirements

### Requirement: Geometry is a step within the MIDI flow

The MIDI flow SHALL be single. After a port is chosen, the flow SHALL ask the
student what shape the instrument is — its **geometry** — and SHALL offer:

- a **shipped kit schematic**, where one describes their instrument;
- a **grid** of a stated number of columns and rows;
- a **neutral arrangement** of a stated number of pads, for an instrument no
  schematic describes.

Where the port matches a known device, the matching geometry SHALL be
**pre-selected and named**, and the student SHALL be able to reject it and choose
any other geometry in place, without returning to the port step.

A device that matches nothing SHALL NOT be pre-selected as a grid. The geometry
step SHALL present the choice on equal terms and let the student answer.

The step SHALL be phrased as a choice between pictures of instruments, not as a
taxonomy, so a student who has never heard the word "geometry" can answer it.

Every geometry SHALL lead to the same subsequent steps — capture, pedals where
applicable, and try-it — with the same controls available in each.

#### Scenario: A recognised kit is pre-selected

- **WHEN** the chosen port matches a shipped kit profile
- **THEN** the geometry step opens with that kit's schematic selected and the kit named
- **AND** the student can choose a different geometry instead

#### Scenario: A recognised pad device is pre-selected

- **WHEN** the chosen port matches a known pad device
- **THEN** the grid geometry is pre-selected at that device's columns and rows
- **AND** the student can choose a different geometry instead

#### Scenario: An unrecognised device is not assumed

- **WHEN** the chosen port matches nothing
- **THEN** no geometry is pre-selected as the answer
- **AND** the schematic, grid and neutral choices are offered on equal terms

#### Scenario: The detection is wrong

- **WHEN** the student rejects the pre-selected geometry
- **THEN** they choose another in place
- **AND** the flow continues from the geometry step without losing the chosen port

#### Scenario: Every geometry reaches the same steps

- **WHEN** any geometry is chosen
- **THEN** the flow continues into capture and then try-it
- **AND** the controls offered during capture are the same whichever geometry was chosen

### Requirement: A re-map preserves everything but the notes

Whether a MIDI instrument is already configured, and that a configured one opens
at try-it rather than at capture, is specified by `setup-flows`. This requirement
governs what a **re-map** of a MIDI instrument preserves.

Re-mapping SHALL be available from try-it, and SHALL drop into the full capture
path for the geometry the instrument was configured with. A re-map SHALL clear
the captured notes and preserve everything else, so edited sounds, labels, the
chosen geometry and a correct hi-hat classification all survive it.

The student SHALL be able to change the geometry as part of a re-map, and SHALL
be told that doing so discards the mapping, because a different geometry has
different pads.

#### Scenario: Re-mapping from try-it

- **WHEN** the student chooses to re-map from the try-it step
- **THEN** the capture path for that instrument's geometry is entered
- **AND** sounds, labels, geometry and pedal settings are retained while notes are cleared

#### Scenario: Changing the geometry during a re-map

- **WHEN** the student changes the geometry while re-mapping
- **THEN** they are told the existing mapping will be discarded
- **AND** on confirming, capture starts afresh for the new geometry

#### Scenario: A correct hi-hat classification survives a re-map

- **WHEN** an instrument whose hi-hat was classified as two notes is re-mapped
- **THEN** that classification is retained

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

Where a captured note is itself a General MIDI percussion note, it SHALL be
adopted as that pad's sound for every geometry, because an instrument that names
its own pads in GM is a better source than any suggestion.

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

#### Scenario: A GM note is adopted as the sound

- **WHEN** the captured note is a General MIDI percussion note
- **THEN** it becomes that pad's sound, overriding the geometry's suggestion

### Requirement: Pedal discovery

The MIDI flow SHALL include a pedals step **when the chosen geometry has pedal
pads**, and SHALL omit the step entirely when it has none, rather than asking
about feet an instrument does not have.

The step SHALL determine how the instrument's hi-hat behaves by observing three
gestures: the pedal alone, the hi-hat struck with the pedal open, and the hi-hat
struck with the pedal closed.

From those observations the system SHALL classify the hi-hat as one of:

- **two notes** — open and closed strikes send different notes, needing no
  pedal state;
- **stateful** — both strikes send the same note and the pedal emits a message
  of its own, which is recorded so pedal position can be tracked;
- **none** — the pedal emits nothing usable, and the hi-hat is a single voice.

Where the two-note form is observed it SHALL be preferred, because it needs no
state to be correct.

The step SHALL also capture the **bass pedal**, ahead of the hi-hat. Pads that
arrive via a footswitch jack SHALL NOT appear in the pad-capture loop: that loop
asks the student to hit the pad lit on the picture, which a foot does not do,
and it left the bass pedal with nowhere to be skipped.

**Every pedal SHALL be skippable on its own, and the step as a whole SHALL be
skippable.** Owning the module without the footswitches is ordinary, and each
pedal is independent of the other. Skipping the bass pedal SHALL leave the kick
unmapped rather than guessed at; skipping the hi-hat gestures SHALL leave a
single-voice hat. Either way the rest of the setup SHALL be complete and usable.

What was skipped SHALL be stated rather than left blank, so a kick that will
never sound is known before a lesson rather than during one.

#### Scenario: A geometry with no pedals omits the step

- **WHEN** the chosen geometry has no pedal pads
- **THEN** the pedals step is not shown
- **AND** the flow continues from capture to try-it

#### Scenario: A geometry with pedals includes the step

- **WHEN** the chosen geometry has a pedal pad
- **THEN** the pedals step is shown after capture

#### Scenario: A kit with no bass pedal

- **WHEN** the student skips the bass pedal
- **THEN** the kick is left unmapped
- **AND** the setup completes and every other drum still plays
- **AND** the step says the kick will not sound

#### Scenario: A kit with a bass pedal but no hi-hat pedal

- **WHEN** the student captures the bass pedal and skips the hi-hat gestures
- **THEN** the kick is mapped and the hi-hat is classified as a single voice
- **AND** both outcomes are stated together

#### Scenario: Feet are not asked for by hand

- **WHEN** the pad-capture loop runs on an instrument with a footswitch-driven kick
- **THEN** that kick is not one of the pads it asks the student to hit

#### Scenario: A kit sending two hi-hat notes

- **WHEN** the open and closed strikes are observed to send different notes
- **THEN** the hi-hat is classified as two notes
- **AND** the open note is assigned the open hi-hat sound and the closed note the
  closed one

#### Scenario: A kit with a stateful pedal

- **WHEN** both strikes send the same note and the pedal emits its own message
- **THEN** the hi-hat is classified as stateful
- **AND** the pedal's message is recorded so its position can be tracked at play
  time

#### Scenario: No pedal connected

- **WHEN** the pedal emits nothing during the step
- **THEN** the hi-hat is classified as a single voice
- **AND** the student is told which hi-hat sound it will play

#### Scenario: The whole step is skipped

- **WHEN** the student skips the pedals step outright
- **THEN** setup completes with a single-voice hi-hat and no kick pedal
- **AND** the student can return to the step later without re-mapping the pads

### Requirement: Generic kit setup

For an instrument no shipped schematic describes, the MIDI flow SHALL offer the
**neutral geometry**, in which the student states the instrument's name and how
many pads it has, then labels and captures each pad with a drum role.

The neutral geometry SHALL produce a controller of the same shape and
completeness as one built from a schematic, and SHALL support the pedals and
try-it steps in the same way.

Where no schematic exists, the pads SHALL be presented in a neutral arrangement
rather than the flow refusing to continue.

A pad the student assigns a pedal role to SHALL be excluded from the pad-capture
loop and captured on the pedals step, wherever it sits in the pad order. The pad
named and highlighted during capture SHALL always be the pad the student's next
hit will map, and the pad any label or role edit on that step applies to.

#### Scenario: An unlisted kit is fully configured

- **WHEN** a student completes the neutral geometry for an instrument with no schematic
- **THEN** the saved controller carries every pad's label, role, note and sound
- **AND** lessons play on it exactly as they would on one built from a schematic

#### Scenario: Pedals and test are available without a profile

- **WHEN** a neutral-geometry setup reaches the pedals and try-it steps
- **THEN** both behave as they do for a schematic geometry
- **AND** try-it lights the pads in their neutral arrangement

#### Scenario: A pedal pad anywhere in the order is skipped by capture

- **WHEN** the student assigns a pedal role to a pad that is not the last one
- **THEN** the pad-capture loop does not ask them to hit it
- **AND** every subsequent pad the loop highlights is the pad it names

#### Scenario: Editing on the capture step edits the highlighted pad

- **WHEN** the student changes the label or role shown on the capture step
- **THEN** the change applies to the pad currently highlighted on the picture

## REMOVED Requirements

### Requirement: Branch after the device step

**Reason**: The wizard no longer branches on the kind of instrument. `setup-flows`
asks the student what they are playing on before any device is chosen, and within
the MIDI flow the grid/kit distinction becomes the geometry step — see the added
"Geometry is a step within the MIDI flow". There is no longer a grid path and a
drum path to branch between, so a requirement governing that branch has nothing
to describe.

**Migration**: The progress-rail guarantee this requirement carried ("the rail
shows the steps of the active path only") is now `setup-flows` → "The progress
rail describes the chosen flow only". The re-entry guarantee ("going back
re-opens the choice") is covered by the geometry step being revisitable without
losing the chosen port.

### Requirement: Detected kit with an override

**Reason**: Folded into the added "Geometry is a step within the MIDI flow", which
generalises it. Detection pre-selecting a geometry and the student overriding it
in place is now specified for all three geometries rather than only for a matched
kit profile — the asymmetry this requirement encoded (a matched kit gets an
override, an unmatched device gets silently routed to a grid) was the defect.

**Migration**: Both of its scenarios survive as scenarios of the added
requirement, alongside the previously missing case of a device that matches
nothing.

### Requirement: Test step

**Reason**: Promoted to `setup-flows` → "Every flow ends in a try-it step", so that
the keyboard and touch flows get it too. It was specified here as drum-path-only,
which is why the grid path never proved its mapping and the virtual flows had no
test at all.

**Migration**: Every guarantee moves intact — hits lighting and naming their drum,
unmapped input being reported rather than ignored, and a direct return to capture
and pedals. The promoted requirement adds that try-it must exercise the real
input surface.

### Requirement: A known controller is checked, not re-mapped

**Reason**: Split in two. The entry rule — that an instrument already configured
on this machine opens at its try-it step with the stored mapping loaded, rather
than asking the student to press every pad again — is promoted to `setup-flows`
→ "An already-configured instrument opens at try-it", so that it covers the
keyboard and touch flows too and not only MIDI. What survives here is the
MIDI-specific half: the added "A re-map preserves everything but the notes".

**Migration**: "A previously configured controller is reconnected" and "A
half-finished setup is not treated as known" become scenarios of the promoted
`setup-flows` requirement. "The check names what each pad plays" becomes a
scenario of `setup-flows` → "Every flow ends in a try-it step", which requires
every recognised hit to name the drum it plays and sound it. "Re-mapping from the
check" becomes "Re-mapping from try-it" on the added requirement, which
additionally specifies what a geometry change during a re-map does.
