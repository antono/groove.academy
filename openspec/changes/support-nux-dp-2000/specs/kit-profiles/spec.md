# kit-profiles

## MODIFIED Requirements

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

## ADDED Requirements

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
