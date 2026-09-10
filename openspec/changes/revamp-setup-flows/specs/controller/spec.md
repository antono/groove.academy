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

An instrument SHALL count as configured only when it has at least one mapped pad.
A stored configuration with no mapped pad SHALL NOT count.

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
