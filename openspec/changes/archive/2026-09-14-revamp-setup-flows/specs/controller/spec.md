## ADDED Requirements

### Requirement: The active instrument is persisted state

The system SHALL persist which configured instrument is **active** on this
machine, and SHALL expose it as observable state so that every reader — the
header, a lesson page, and the gate on practice — resolves the same instrument.

Resolution SHALL be explicit and in this order: a selection made during this
session, then the persisted selection, and otherwise **none**. No input SHALL be
selected on the student's behalf when nothing is configured.

Setting the active instrument SHALL persist it and SHALL notify readers without
requiring a reload. A persisted selection naming an instrument that is no longer
configured SHALL resolve as if no selection had been made, rather than resolving
to a missing instrument.

The active selection SHALL remain device-local and SHALL NOT be synced to an
account, because which instrument is in front of the student is a property of the
machine.

#### Scenario: A selection persists across sessions

- **WHEN** an instrument is made active and the app is later reopened
- **THEN** that instrument resolves as active

#### Scenario: Readers agree

- **WHEN** the active instrument is changed
- **THEN** every reader of the active instrument resolves to the newly selected one

#### Scenario: Nothing configured resolves to none

- **WHEN** no instrument is configured on this machine
- **THEN** the active instrument resolves to none
- **AND** no default input is chosen on the student's behalf

#### Scenario: A stale selection is discarded

- **WHEN** the persisted selection names an instrument whose configuration no longer exists
- **THEN** it resolves as if no selection had been made

#### Scenario: The selection is not synced

- **WHEN** the student signs in on another machine
- **THEN** that machine's own active selection is unaffected

### Requirement: Configured-instrument query

The system SHALL answer whether **any** instrument is configured on this machine,
separately from naming them, so that a caller deciding whether to gate practice
does not have to enumerate and interpret the registry itself.

A **hardware** instrument SHALL count as configured only when it has at least one
mapped pad. A stored configuration with no mapped pad SHALL NOT count.

A **virtual** source SHALL count as configured once its mapping has been stored,
and SHALL NOT count before that. Pad count cannot decide it: a virtual pad is
given a synthetic note when its controller is built, so a pristine default is
indistinguishable from an edited mapping by pad count alone. The question the
query answers for a virtual source is therefore "has this source been stored",
which is true exactly when the student has been through its flow.

The query SHALL cover virtual sources explicitly. It SHALL NOT be derived solely
from the configured-instrument registry, because that registry omits the reserved
ids virtual sources use — an omission that exists so a virtual source is not
double-listed in a device chooser, and which would otherwise make a student who
has just completed a virtual flow appear unconfigured.

#### Scenario: A machine with no configuration

- **WHEN** nothing has ever been set up on this machine
- **THEN** the query reports that no instrument is configured

#### Scenario: A machine with a configured instrument

- **WHEN** at least one instrument has a mapped pad
- **THEN** the query reports that an instrument is configured

#### Scenario: A half-finished configuration does not count

- **WHEN** the only stored configuration has no mapped pads
- **THEN** the query reports that no instrument is configured

#### Scenario: The query does not depend on presence

- **WHEN** a configured instrument's MIDI port is not connected
- **THEN** the query still reports that an instrument is configured

#### Scenario: A completed virtual flow counts immediately

- **WHEN** the student completes the keyboard or touch flow and nothing else is configured
- **THEN** the query reports that an instrument is configured
- **AND** a lesson opened straight afterwards is not gated

#### Scenario: An untouched virtual source does not count

- **WHEN** no virtual source has ever been stored and no hardware is configured
- **THEN** the query reports that no instrument is configured

### Requirement: A run in progress is observable state

Whether a scored run is in progress SHALL be observable outside the page that
hosts the run, so that a surface elsewhere in the app can decline to act
mid-run. It SHALL be set when a scored run starts and cleared when the run ends
or is abandoned, including when the hosting page is left.

A paused run SHALL still count as in progress, because it has not ended and its
scoring is still open.

This exists because the active instrument must not change underneath a run
(see `instrument-switcher`), and the control that would change it does not live
in the page that knows a run is happening.

#### Scenario: A run is visible elsewhere

- **WHEN** a scored run starts
- **THEN** a reader outside the lesson page can observe that a run is in progress

#### Scenario: A paused run still counts

- **WHEN** a run is paused but not ended
- **THEN** it is still reported as in progress

#### Scenario: Ending a run clears the state

- **WHEN** a run reaches its result screen, is abandoned, or its page is left
- **THEN** it is no longer reported as in progress
