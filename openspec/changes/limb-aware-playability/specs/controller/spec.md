# controller

## ADDED Requirements

### Requirement: Voice count

A controller SHALL be able to say how many scored hits its student can land at
one instant — its **voice count**.

It SHALL follow from how the model is **struck**, which SHALL be looked up in a
catalogue of models rather than inferred from how the device is drawn. Those are
different questions: a stick-played multipad is not a kit schematic, and a
sixteen-pad groove box is finger-played. An instrument struck with **sticks**
SHALL report two voices however many pads it has; one struck with **fingers**
SHALL report its pad count, each pad being independently reachable.

The catalogue SHALL be matched against the model name, never a manufacturer
alone. It MAY be extended from documentation: whether an instrument is hit with
sticks or fingers is a fact about its size and purpose that a photograph
settles, unlike a pad's MIDI note, which only real hardware can establish.

A pedal SHALL add a voice only where it **scores**. A bass pedal occupies a limb
that produces a note; a hi-hat pedal is control rather than performance, sounds
nothing and frees no hand, so it SHALL add none.

Where the catalogue does not describe the model, the controller SHALL report no
limit rather than guess, and nothing SHALL be marked. The exception is a
**grid**, which is finger-played by construction — a student chooses that
geometry because their pads sit under one hand.

The count SHALL be derived rather than stored, so no configuration saved before
it existed needs migrating and no student is asked a question to obtain it.

#### Scenario: A stick-played kit with no bass pedal

- **GIVEN** a kit controller whose kick arrives from a pad rather than a footswitch
- **THEN** its voice count is two

#### Scenario: A kit with a bass pedal

- **GIVEN** a kit controller with a bass pedal configured
- **THEN** its voice count is three

#### Scenario: A hi-hat pedal adds nothing

- **GIVEN** a kit controller whose only pedal is tracked for hi-hat position
- **THEN** its voice count is two

#### Scenario: A grid is counted by its pads

- **GIVEN** a grid controller of sixteen pads
- **THEN** its voice count is sixteen

#### Scenario: A stick-played multipad that is not a kit schematic

- **GIVEN** a controller whose model the catalogue lists as stick-played
- **THEN** its voice count is two regardless of how many pads it reports

#### Scenario: An unrecognised instrument is not guessed at

- **GIVEN** a controller whose model appears in no catalogue entry
- **AND** whose geometry is not a grid
- **THEN** it reports no limit
- **AND** no lesson is marked as beyond it

#### Scenario: A configuration saved before this existed

- **WHEN** a controller stored before voice counts existed is loaded
- **THEN** it reports a voice count without migration
- **AND** nothing in its stored shape is rewritten

## MODIFIED Requirements

### Requirement: Capability query

A controller SHALL be able to say which GM drum notes it can produce, and
whether it can produce a given one.

A controller SHALL also be able to say whether it can produce a given number of
hits at one instant, so a lesson's demand can be compared against the student's
reach before a run rather than discovered during one.

Where a lesson requires a drum the controller cannot produce — most commonly an
open hi-hat on a kit with no pedal — the resting lesson page SHALL say so before
the run starts. The lesson SHALL remain playable and the affected notes SHALL
score as they normally would rather than being silently excused.

Where a lesson requires more simultaneous hits than the controller's voice
count, the resting lesson page SHALL say so in the same place, and SHALL name
what would change the answer. The lesson SHALL remain playable on the same
terms: the student, not the app, decides whether to attempt it.

#### Scenario: A no-pedal kit meets an open hi-hat

- **GIVEN** a controller whose hi-hat is a single voice
- **WHEN** a lesson containing open hi-hat notes is opened
- **THEN** the page states that this controller cannot play those notes
- **AND** the Play button remains available

#### Scenario: A two-voice kit meets a three-voice lesson

- **GIVEN** a kit controller with a voice count of two
- **WHEN** a lesson requiring three simultaneous hits is opened
- **THEN** the page states that it needs more hits at once than the instrument allows
- **AND** it names what would change that
- **AND** the Play button remains available

#### Scenario: A fully capable controller says nothing

- **WHEN** the controller can produce every drum a lesson uses
- **AND** its voice count meets the lesson's demand
- **THEN** no warning is shown
