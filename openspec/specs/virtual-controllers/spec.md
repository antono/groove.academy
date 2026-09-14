# virtual-controllers Specification

## Purpose

Lets a student play and score a lesson using a computer keyboard or an on-screen
touch pad grid, so the app is playable with no MIDI hardware and on devices that
have no Web MIDI at all.

## Requirements

### Requirement: Virtual input sources are selectable

The system SHALL offer a computer keyboard and an on-screen touch pad grid as
input sources for playing a lesson, listed alongside any connected Web MIDI
ports. The student SHALL be able to select one of them as the active input, and
the selection SHALL persist across sessions the same way a chosen Web MIDI device
does.

Both sources SHALL be offered **wherever inputs are listed**, including the MIDI
flow's own port list. A student who has connected a controller and then decides to
use the keyboard SHALL be able to say so from that list, without retracing their
steps.

Neither source SHALL be presented as a fallback for the absence of hardware. They
are instruments the curriculum is playable on, and SHALL be offered as first-class
answers to what the student is playing on — see `setup-flows`.

#### Scenario: Virtual sources listed with hardware

- **WHEN** the student opens the input/device selection with or without a Web MIDI controller connected
- **THEN** the keyboard and on-screen touch pads appear as selectable sources in addition to any connected Web MIDI ports

#### Scenario: Virtual sources appear in the MIDI flow's port list

- **WHEN** the student is choosing a port inside the MIDI flow
- **THEN** the keyboard and the on-screen pads are also offered there
- **AND** choosing one enters that source's flow

#### Scenario: No hardware and no Web MIDI support

- **WHEN** the browser has no Web MIDI support, or no controller is connected
- **THEN** the app still reaches a state where a lesson can be played, because at least one virtual source is available and selectable

#### Scenario: Selection persists

- **WHEN** the student selects a virtual source and later reopens the app
- **THEN** that virtual source is the active input again without reselecting it

### Requirement: Keyboard plays a lesson

The system SHALL map computer-keyboard keys to pads using a built-in default
layout, so that pressing a mapped key while the keyboard source is active
produces a drum hit that is scored identically to a MIDI hit. Auto-repeat from a
held key SHALL NOT produce additional hits.

#### Scenario: Key press scores a hit

- **WHEN** the keyboard source is active during a scored run and the student presses a mapped key
- **THEN** the corresponding pad's drum sounds and the hit is scored against the lesson's timing windows exactly as a MIDI hit would be, contributing to the result report and per-pad breakdown

#### Scenario: Unmapped key is ignored

- **WHEN** the student presses a key that is not in the layout
- **THEN** no drum sounds and nothing is scored

#### Scenario: Held key does not repeat

- **WHEN** the student holds a mapped key down past the keyboard auto-repeat threshold
- **THEN** exactly one hit is produced, not a stream of repeats

### Requirement: On-screen touch pads play a lesson

The system SHALL present an on-screen pad grid, sized for touch, that produces a
scored drum hit when a pad is tapped while the touch source is active. A tap
SHALL be scored identically to a MIDI hit.

#### Scenario: Tap scores a hit

- **WHEN** the touch source is active during a scored run and the student taps a pad
- **THEN** that pad's drum sounds and the hit is scored against the lesson's timing windows exactly as a MIDI hit would be

#### Scenario: Playable on a touchscreen with no Web MIDI

- **WHEN** the student is on a phone or tablet with no Web MIDI support
- **THEN** the on-screen pads are available and a lesson can be played to its result screen

### Requirement: Each virtual source has its own editable mapping

Each virtual source SHALL carry its own pad-to-GM-drum mapping, defaulting to a
sensible built-in layout and editable by the student. Because a virtual source
emits no controller note to capture, its mapping SHALL be chosen or edited
directly rather than learned from hardware, and edits SHALL persist across
sessions.

Editing the mapping SHALL be an **optional** step, not the flow. A virtual flow
SHALL NOT require the student to visit the mapping editor before their instrument
is usable, because the default mapping is already complete and correct; the flow's
required step is try-it.

**Completing a virtual flow SHALL store the source's mapping even when the student
changed nothing.** Storing it is what makes the source count as configured (see
`controller`), and without it a student who has just finished the keyboard flow is
indistinguishable from one who has never opened the app — which would gate them out
of the lesson they were on their way to.

The editor SHALL state each pad's assigned drum once, not twice, and SHALL make
clear which control assigns the drum and which control auditions it.

#### Scenario: Default mapping is usable immediately

- **WHEN** a virtual source is used for the first time with no prior configuration
- **THEN** it already has a complete default pad-to-drum mapping and can play a lesson without any setup

#### Scenario: The mapping editor is not compulsory

- **WHEN** a student chooses the keyboard or the touch surface in setup
- **THEN** they reach a playable, configured instrument without being required to change any pad's drum

#### Scenario: An unedited flow still stores the source

- **WHEN** the student completes a virtual flow without changing any pad
- **THEN** that source's mapping is stored
- **AND** it counts as a configured instrument

#### Scenario: Edited mapping persists

- **WHEN** the student changes which drum a pad triggers for a virtual source
- **THEN** the new mapping is used for that source and is retained when the app is reopened

#### Scenario: Assigning and auditioning are distinguishable

- **WHEN** the student views a pad in the mapping editor
- **THEN** the drum it plays is stated once
- **AND** the control that changes it and the control that sounds it are visually distinct

### Requirement: Keyboard transport hotkeys

The system SHALL let the student start or resume, and stop or pause, a lesson run
from the keyboard while the keyboard source is active, so a keyboard-only student
can run a lesson end to end without hardware transport controls. The on-screen
touch controller SHALL rely on its existing visible start/pause controls and
requires no additional transport binding.

The keyboard flow SHALL state its transport keys as part of the flow, at the
point the student can act on them, rather than only in passing prose. The keys
SHALL be exercisable on the try-it step, so the student has pressed them once
before a scored run depends on them.

#### Scenario: Start and resume from the keyboard

- **WHEN** the keyboard source is active and the lesson is at rest or paused, and the student presses the transport start hotkey
- **THEN** the run starts, or resumes from where it was paused

#### Scenario: Stop and pause from the keyboard

- **WHEN** a run is in progress and the student presses the transport stop hotkey
- **THEN** the run pauses, and a subsequent stop press ends the run, matching how a hardware Stop button behaves

#### Scenario: The transport keys are stated in the flow

- **WHEN** the student completes the keyboard flow
- **THEN** the start and stop keys have been stated to them

#### Scenario: The transport keys work on try-it

- **WHEN** the student presses the transport keys on the keyboard flow's try-it step
- **THEN** they act as they will during a lesson

### Requirement: Virtual runs are attributed in practice stats

A scored run played on a virtual source SHALL be recorded in practice stats with
a stable identity for that source, so the run is attributed to the keyboard or
the touch pads rather than recorded as having no controller.

#### Scenario: Keyboard run is attributed

- **WHEN** a lesson is played to the result screen with the keyboard source active
- **THEN** the recorded session identifies the keyboard as the controller, distinct from `null` and from any Web MIDI device

#### Scenario: Touch run is attributed

- **WHEN** a lesson is played to the result screen with the touch source active
- **THEN** the recorded session identifies the on-screen touch pads as the controller, distinct from the keyboard and from any Web MIDI device

### Requirement: A virtual source is offered by device capability

Which virtual source is offered first SHALL follow what the device can do: a
device reporting a coarse pointer SHALL be offered the touch surface ahead of the
keyboard, and a device with a fine pointer the reverse.

Both SHALL remain selectable regardless, because pointer type is a poor proxy for
what a student has to hand — a tablet may have a keyboard attached, and a desktop
may have a touch screen.

A device that cannot support a source at all SHALL still list it rather than
hiding it, and SHALL say what it needs.

#### Scenario: A phone leads with touch

- **WHEN** setup is opened on a device reporting a coarse pointer
- **THEN** the touch surface is offered ahead of the keyboard

#### Scenario: A desktop leads with the keyboard

- **WHEN** setup is opened on a device reporting a fine pointer
- **THEN** the keyboard is offered ahead of the touch surface

#### Scenario: The non-preferred source is still selectable

- **WHEN** a student on a phone chooses the keyboard
- **THEN** the keyboard flow is entered and its mapping is configured
