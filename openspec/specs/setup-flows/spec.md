# setup-flows Specification

## Purpose

The shape of setup: the screen that asks what instrument the student plays, the
three flows that answer it — keyboard, touchscreen, MIDI — and the rules they all
share, including the try-it step every flow ends in and the gate that stops a
lesson opening with no instrument at all.

## Requirements

### Requirement: The instrument is asked, not inferred

Setup SHALL open on a screen that asks the student what they are playing on, and
SHALL offer exactly three answers: a **computer keyboard**, an **on-screen touch
surface**, and a **MIDI instrument**.

Device detection SHALL NOT choose a flow. Where a connected port matches a known
device, that knowledge SHALL be used only to pre-select a suggestion **inside**
the MIDI flow, and the student SHALL be able to reject it.

No flow SHALL be entered as a consequence of a pattern match against a device
name or manufacturer.

#### Scenario: The first screen asks

- **WHEN** the student enters setup
- **THEN** they are asked what they are playing on
- **AND** the keyboard, the touch surface and a MIDI instrument are all offered as answers

#### Scenario: A recognised device does not pick the flow

- **WHEN** a connected port matches a known kit or pad device
- **THEN** the student is still asked what they are playing on
- **AND** the match is applied only after they have chosen the MIDI flow

#### Scenario: An unrecognised MIDI instrument is not assumed to be a pad grid

- **WHEN** the student chooses the MIDI flow with a device that matches nothing
- **THEN** the flow does not assume a grid of pads
- **AND** the student states the instrument's shape themselves

### Requirement: Every answer stays available, whatever the browser can do

The three answers SHALL all remain selectable regardless of what the browser or
device supports. Capability detection SHALL be used only to **order** the answers
and to **annotate** ones that cannot work here.

A primary action that cannot succeed SHALL NOT be presented as the screen's
main action. Where Web MIDI is unavailable, the MIDI answer SHALL be ordered
after the others and SHALL state what is needed to use it, rather than being
offered first and disabled.

Detecting capability SHALL NOT require requesting MIDI access, so a permission
prompt that is never answered cannot delay the screen.

#### Scenario: A browser with no Web MIDI

- **WHEN** the browser cannot provide Web MIDI
- **THEN** the screen's leading answer is one that works on this device
- **AND** the MIDI answer is still listed, with a statement of what it needs
- **AND** no disabled control is the most prominent thing on the screen

#### Scenario: A touchscreen device

- **WHEN** the device reports a coarse pointer
- **THEN** the touch answer is ordered ahead of the keyboard answer

#### Scenario: A controller connected later is still reachable

- **WHEN** a student on a device that had no MIDI support selects the MIDI answer anyway
- **THEN** the MIDI flow is entered

#### Scenario: The screen does not wait on a permission prompt

- **WHEN** the screen is shown
- **THEN** it renders without requesting MIDI access
- **AND** an unanswered MIDI permission prompt cannot prevent an answer being chosen

### Requirement: Each flow has its own address

Each of the three flows SHALL be reachable at its own URL, so a flow can be
linked to, returned to and resumed. The address that asks the question SHALL
remain the setup entry point, so existing links into setup continue to resolve.

#### Scenario: A flow is linked directly

- **WHEN** a student opens a flow's own address
- **THEN** that flow is entered without passing through the question

#### Scenario: The setup entry point still resolves

- **WHEN** a student follows an existing link to setup
- **THEN** they arrive at the screen that asks what they are playing on

### Requirement: The progress rail describes the chosen flow only

The progress rail SHALL show the steps of the flow the student is actually in,
and SHALL NOT display the steps of any flow before one has been chosen.

The rail SHALL mark the current step. Its legibility at narrow widths is
specified by `responsive-layout`.

#### Scenario: No flow chosen yet

- **WHEN** the student is on the screen that asks what they are playing on
- **THEN** the rail does not enumerate the steps of a particular flow

#### Scenario: The rail matches the flow walked

- **WHEN** a student chooses a flow
- **THEN** the number of steps shown equals the number the flow will ask them to walk

#### Scenario: The current step is marked

- **WHEN** the student is on any step of a flow
- **THEN** the rail marks that step as the current one

### Requirement: Every flow ends in a try-it step

Every flow SHALL end in a step where the student plays freely and sees what the
system makes of their input: a recognised hit SHALL light its pad and name the
drum it plays, and SHALL sound that drum. Input that maps to nothing SHALL be
reported as unmapped rather than silently ignored.

Try-it SHALL exercise the same input surface a lesson uses, so what the student
feels there is what a lesson will do. For the touch flow that means the actual
on-screen pads; for the keyboard flow, the actual keys.

Try-it SHALL offer a direct return to the steps that could be wrong, so a bad
mapping is corrected where it is discovered.

#### Scenario: A hit is named and sounded

- **WHEN** the student plays a mapped pad on the try-it step
- **THEN** the pad lights, the drum it plays is named, and that drum sounds

#### Scenario: Unmapped input is surfaced

- **WHEN** the student produces input that maps to no pad
- **THEN** the step reports it as unmapped rather than showing nothing

#### Scenario: Touch try-it uses the real pads

- **WHEN** the touch flow reaches try-it
- **THEN** tapping the pads there behaves as tapping them during a lesson does

#### Scenario: Keyboard try-it uses the real keys

- **WHEN** the keyboard flow reaches try-it
- **THEN** pressing a mapped key there behaves as pressing it during a lesson does

#### Scenario: A wrong mapping is corrected from try-it

- **WHEN** the student sees the wrong drum respond
- **THEN** they can return to the step that assigned it
- **AND** what was already correct is retained

### Requirement: An already-configured instrument opens at try-it

Where the instrument a flow is about already has a stored configuration with at
least one mapped pad, the flow SHALL open at its try-it step with that
configuration loaded, and SHALL NOT ask the student to map anything again.

This SHALL apply to every flow, not only to MIDI instruments. Re-mapping SHALL be
available from try-it.

For a **hardware** instrument, a stored configuration with no mapped pad SHALL
NOT count as configured, and the flow SHALL proceed as it would for a new
instrument.

For a **virtual** source the test SHALL be whether its mapping has been stored,
not how many pads are mapped — a pristine virtual source already has a note on
every pad, so a pad count cannot tell a default from an edit (see `controller`).

#### Scenario: A configured MIDI instrument is checked, not re-mapped

- **WHEN** the student chooses a MIDI instrument this machine has already been set up against
- **THEN** the flow opens at try-it with the stored mapping loaded
- **AND** no capture step is shown

#### Scenario: A virtual source already set up is checked, not re-edited

- **WHEN** the student enters the keyboard or touch flow having already been through it
- **THEN** the flow opens at try-it rather than at the mapping editor

#### Scenario: A virtual source never set up is not treated as configured

- **WHEN** the student enters a virtual flow for the first time
- **THEN** the flow does not treat the built-in default as an existing setup

#### Scenario: A half-finished configuration is not treated as configured

- **WHEN** a stored configuration has no mapped pads
- **THEN** the flow proceeds as it would for a new instrument

### Requirement: Setup gates practice

Where **no** instrument is configured on this machine, opening a lesson SHALL
route the student to the screen that asks what they are playing on, rather than
selecting an input on their behalf.

The gate SHALL fire only when nothing at all is configured. A machine that has a
configured instrument SHALL NOT be gated, whether or not that instrument is
currently present.

From the gate, choosing the keyboard or the touch surface SHALL reach a playable,
already-mapped instrument without any further mapping step, so the gate costs one
choice rather than a setup session.

**The gate SHALL remember the lesson it interrupted**, and the flow it routes
into SHALL offer a return to that lesson when it completes, rather than only to
the catalogue. A gate that strands the student one navigation short of what they
set out to do has moved the cost rather than removed it.

The remembered destination SHALL be treated as untrusted input: it SHALL route
only within this application, and anything else SHALL be discarded in favour of
the ordinary destination. Setup entered directly, rather than through the gate,
SHALL offer the ordinary destination and SHALL NOT invent one.

#### Scenario: The interrupted lesson is offered back

- **WHEN** a student is gated while opening a lesson and then completes a flow
- **THEN** the flow's closing step offers to return to that same lesson

#### Scenario: Setup entered directly has nothing to return to

- **WHEN** the student enters setup from the menu rather than through the gate
- **THEN** the closing step offers the ordinary destination

#### Scenario: A hostile destination is discarded

- **WHEN** the remembered destination does not point within this application
- **THEN** it is discarded and the ordinary destination is offered instead

#### Scenario: A first-time student is gated

- **WHEN** a lesson is opened and nothing is configured
- **THEN** the student is routed to the question instead of into the lesson

#### Scenario: The gate is one choice deep

- **WHEN** a gated student chooses the keyboard or the touch surface
- **THEN** that source is configured with its default mapping and is immediately playable

#### Scenario: A configured machine is not gated

- **WHEN** a lesson is opened and at least one instrument is configured
- **THEN** the lesson opens

#### Scenario: An absent instrument does not re-gate

- **WHEN** the configured instrument's port is not currently connected
- **THEN** the lesson still opens rather than routing back to setup
