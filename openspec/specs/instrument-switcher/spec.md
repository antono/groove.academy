# instrument-switcher Specification

## Purpose

The header's standing answer to "what am I playing on right now" — a chip naming
the active instrument and whether it is actually connected, and a dropdown for
switching between the instruments this machine has been set up against or setting
up another.

## Requirements

### Requirement: The active instrument is named in the header

Once at least one instrument is configured on this machine, the site header SHALL
name the active instrument alongside its existing controls.

Where nothing is configured, the header SHALL NOT show the chip, because there is
nothing to name and setup is gated anyway.

#### Scenario: A configured instrument is named

- **WHEN** at least one instrument is configured and one is active
- **THEN** the header names that instrument

#### Scenario: Nothing configured shows nothing

- **WHEN** no instrument is configured on this machine
- **THEN** the header shows no instrument chip

### Requirement: Connected and configured are distinguished

The chip SHALL distinguish an instrument that is **present** from one that is
merely **configured**, and SHALL never describe a configured instrument as
connected on the strength of its configuration alone.

**The chip SHALL NOT request MIDI access in order to find out.** Presence is
reported only from access some other surface already holds — a lesson page, or
the MIDI flow — because the chip renders on every page including the one that
`setup-flows` forbids from requesting access. Where no access is held, the chip
SHALL report the instrument as **configured**, making no claim either way about
whether it is plugged in.

Three states are therefore distinguishable, and the third is not a failure:

- **present** — access is held and the port is enumerated;
- **absent** — access is held and the port is not enumerated;
- **unknown** — no access is held, so the chip says only "configured".

The keyboard and the on-screen pads SHALL always be reported as present, because
they need no access to observe and cannot be unplugged.

Where presence is known, a student SHALL be able to tell without starting a
lesson that the instrument they expect to play is not currently reachable.

#### Scenario: A connected MIDI instrument

- **WHEN** the active instrument's MIDI port is enumerated and access is held
- **THEN** the chip shows it as connected

#### Scenario: An unplugged MIDI instrument

- **WHEN** access is held and the active instrument's port is not enumerated
- **THEN** the chip shows it as configured and not currently connected
- **AND** it is not described as connected

#### Scenario: Presence is unknown without access

- **WHEN** no surface has been granted MIDI access yet
- **THEN** the chip names the instrument as configured
- **AND** claims neither that it is connected nor that it is unplugged

#### Scenario: The chip does not request access

- **WHEN** the chip is rendered on a page that has not requested MIDI access
- **THEN** no MIDI access request is made
- **AND** no permission prompt is raised by the chip

#### Scenario: A virtual source is always present

- **WHEN** the active instrument is the keyboard or the on-screen pads
- **THEN** the chip shows it as present

#### Scenario: A port appearing updates the chip

- **WHEN** access is held and the active instrument's port is connected while the app is open
- **THEN** the chip changes to show it as connected without a reload

### Requirement: The header switches between configured instruments

The chip SHALL open a list of every instrument configured on this machine, naming
each one, and selecting one SHALL make it active.

Switching SHALL take effect without a page reload, and SHALL persist so the same
instrument is active when the app is reopened.

Switching SHALL be refused, or take effect only for subsequent runs, while a
scored run is in progress — changing the instrument underneath a run would
invalidate what is being scored.

#### Scenario: The list names what is configured

- **WHEN** the student opens the chip
- **THEN** every instrument configured on this machine is listed by name

#### Scenario: Switching takes effect immediately

- **WHEN** the student selects a different configured instrument
- **THEN** it becomes the active instrument without a reload
- **AND** subsequent hits are interpreted by that instrument's mapping

#### Scenario: The choice persists

- **WHEN** the student switches instrument and later reopens the app
- **THEN** the instrument they switched to is active

#### Scenario: A run in progress is not switched underneath

- **WHEN** a scored run is in progress
- **THEN** the active instrument is not changed mid-run

### Requirement: One authority for the active instrument

The active instrument SHALL be a single piece of state that every part of the app
reads. The header chip and any input chooser on a lesson page SHALL be views of
that state rather than independent selections, and SHALL never disagree about
which instrument is active.

Selecting an instrument in one place SHALL be reflected in the other.

Resolution order SHALL be explicit: a selection made in this session, then the
persisted selection, and otherwise none — which is the condition that gates
practice.

#### Scenario: The header and the lesson chooser agree

- **WHEN** the student changes the instrument from a lesson page
- **THEN** the header chip names the instrument they changed to

#### Scenario: A header switch reaches the lesson page

- **WHEN** the student switches instrument from the header while a lesson page is open
- **THEN** that lesson page uses the newly active instrument

#### Scenario: No configured instrument resolves to none

- **WHEN** nothing is configured
- **THEN** no instrument resolves as active
- **AND** no input is selected on the student's behalf

### Requirement: Setting up another instrument from the switcher

The switcher SHALL offer a way to set up an instrument that is not yet
configured, entering setup without disturbing the current configuration or the
active selection.

Abandoning that setup SHALL leave the previously active instrument active.

#### Scenario: Adding a second instrument

- **WHEN** the student chooses to set up another instrument from the switcher
- **THEN** setup is entered
- **AND** the instruments already configured are unchanged

#### Scenario: Abandoning the addition

- **WHEN** the student leaves that setup without completing it
- **THEN** the instrument that was active before remains active
