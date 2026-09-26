# kit-profiles Specification

## Purpose

Describe an electronic drum kit to the app: which kits are recognised, how a
kit's schematic makes each drum addressable, and the vocabulary of drum roles a
pad can hold. A profile is the description of a model; what a particular
student's instrument turned out to be belongs to the controller.

## Requirements

### Requirement: Kit profile catalogue

The system SHALL ship a catalogue of electronic-kit profiles, each carrying a
stable id, a display label, a name pattern matched case-insensitively against
the MIDI input name, a schematic reference, and an ordered list of pads. A
profile SHALL be matched by the same entry point that matches grid presets, so
one lookup answers "what is this device" for both kinds.

A profile's pattern SHALL be written to match the port **name**. It SHALL NOT
depend on the manufacturer string alone. That string is not reliably the
device's own: a port has been observed reporting the manufacturer of an
unrelated interface on the same machine, so a pattern resting on it matches or
fails according to what else is plugged into the computer.

A profile MAY declare each pad's **factory-default** MIDI note, under the
conditions in "Factory notes and GM meaning". It SHALL NOT declare a note it
has not been able to verify against the model's hardware.

#### Scenario: A recognised kit is identified from its port name

- **WHEN** a MIDI input whose name matches a profile's pattern is selected
- **THEN** that profile is returned, carrying its schematic and pad list

#### Scenario: An unrecognised device falls through unchanged

- **WHEN** a MIDI input matches no kit profile and no grid preset
- **THEN** the lookup returns nothing
- **AND** the device remains fully configurable through the generic path

#### Scenario: A borrowed manufacturer string does not decide a match

- **WHEN** a port reports a manufacturer belonging to a different device on the same machine
- **THEN** the match is decided by the port name alone
- **AND** an unrelated device bearing that manufacturer matches no kit profile

### Requirement: Addressable schematic

Each profile SHALL reference a schematic SVG in which every drum is an element
whose id equals the corresponding pad's id, so a single renderer can mark any
drum as pending, captured, or lit without per-kit code.

Schematics SHALL be loaded only from first-party assets shipped with the app.
Externally supplied or user-submitted content SHALL NEVER be rendered as a
schematic.

#### Scenario: A drum is highlighted by id

- **WHEN** a component asks the renderer to light the pad with a given id
- **THEN** the matching element in that kit's schematic is marked as lit
- **AND** no other drum's appearance changes

#### Scenario: Profile and schematic are checked against each other

- **WHEN** the project is built
- **THEN** every pad id in every profile is verified to exist in that profile's
  schematic
- **AND** a profile whose ids have drifted from its picture fails the build

### Requirement: Drum roles

The system SHALL define a closed vocabulary of drum roles covering at least
kick, snare, tom, hi-hat, crash and ride, and each profile pad SHALL declare one
role and a suggested GM percussion note.

The suggested note SHALL be editable by the student; the role SHALL be what
pedal handling and playability checks reason about, so a kit whose hi-hat is
assigned an unusual sound is still understood to have a hi-hat.

#### Scenario: A suggested sound is changed without losing the role

- **WHEN** a student assigns a different GM note to a pad whose role is hi-hat
- **THEN** the pad's sound changes
- **AND** the pad is still treated as the kit's hi-hat by pedal handling

### Requirement: A profile builds a controller

A profile SHALL be the template from which a drum-kit controller is built: its
pads become the controller's pads, its schematic becomes the controller's
preview geometry, and its suggested sounds become the controller's starting
sounds.

A profile SHALL hold no student-specific state. Captured notes, pedal
classification and edited sounds belong to the controller, so the same profile
serves every student who owns that model.

#### Scenario: Two students share one profile

- **WHEN** two students configure the same model and map its pads differently
- **THEN** both controllers reference the same profile
- **AND** neither student's captured notes appear in the other's controller

#### Scenario: A profile change reaches existing controllers safely

- **WHEN** a shipped profile's label or schematic is corrected
- **THEN** controllers built from it show the correction
- **AND** their captured notes, sounds and pedal settings are unaffected

### Requirement: Factory notes and GM meaning

A profile MAY state, per pad, the MIDI note that pad sends on a **factory** unit,
and MAY state that the model's notes carry **no General MIDI drum meaning**.
Both are properties of the model, established by measurement against real
hardware, and neither is a claim about any particular student's instrument.

A declared factory note SHALL be treated as a starting value only. Any note
captured from the student's own instrument SHALL replace it, because a module
whose notes are reassignable from its front panel may have been reassigned. A
pad for which no factory note is known SHALL be left unmapped rather than
guessed at.

Where a profile declares its notes carry no GM meaning, the pad sounds the
profile supplies SHALL stand, and a captured note SHALL NOT be interpreted as
naming a drum. Some modules send notes inside the GM percussion range whose
values correspond to entirely different instruments than the ones the pads play;
believing such a note assigns the wrong drum to every pad at once.

A profile that declares neither SHALL behave exactly as before: no notes, and
its notes treated as GM-meaningful.

#### Scenario: A factory kit plays without a capture pass

- **WHEN** a controller is built from a profile that declares factory notes for every pad
- **THEN** every pad is mapped and the kit's drums are playable immediately

#### Scenario: A student's own mapping overrides the factory default

- **WHEN** a pad carrying a declared factory note is captured from the student's instrument
- **THEN** the captured note replaces the declared one

#### Scenario: A pad with no known factory note stays unmapped

- **WHEN** a profile declares factory notes for only some of its pads
- **THEN** the remaining pads are left unmapped rather than assigned a placeholder

#### Scenario: A profile silent on both behaves as before

- **WHEN** a profile declares neither factory notes nor a loss of GM meaning
- **THEN** its pads carry no notes
- **AND** its captured notes are treated as naming drums

### Requirement: Declared corners

A kit profile MAY declare which four of its pads sit at the corners of the
instrument — top-left, top-right, bottom-left and bottom-right.

They SHALL be declared rather than derived. A profile's pads are an ordered list
for the wizard to walk, and where a drum physically sits is expressed in the
schematic, which is read only by the preview. Inferring a corner from a pad's
position in that list would be a guess about the picture.

A profile that declares no corners SHALL be valid, and an instrument built from
it SHALL simply have no corner gestures. A partial declaration SHALL be treated
as none: three corners describe no diagonal.

A declared corner SHALL name a pad the profile also declares, so the same
one-to-one contract that binds pads to schematic drums holds here too.

#### Scenario: A profile declares its corners

- **WHEN** a controller is built from a profile declaring four corners
- **THEN** those pads are its corners
- **AND** its corner gestures are available

#### Scenario: A profile that declares none

- **WHEN** a controller is built from a profile declaring no corners
- **THEN** it has no corners and no corner gestures
- **AND** the profile is otherwise fully usable

#### Scenario: A corner naming a pad that does not exist

- **WHEN** a profile declares a corner that is not one of its pads
- **THEN** the authoring check fails
