# controller

## ADDED Requirements

### Requirement: Corner gestures

The controller SHALL recognise two **corner gestures**, each a pair of opposite
corner pads struck close enough together to be one act:

- **again** — the bottom-left corner with the top-right corner
- **next** — the top-left corner with the bottom-right corner

Each SHALL be reported as its own kind of event, distinct from a hit, a pedal, a
transport press and an unmapped note, so a caller reacts to the intent rather
than to a pair of notes.

Two strikes SHALL count as one gesture only when the second lands within a
**recognition window** of the first. The window SHALL be generous enough that a
beginner bringing two hands down at roughly the same time succeeds repeatedly,
rather than requiring a drummer's precision. It SHALL NOT be so wide that a
strike and an unrelated later strike combine.

A pad participating in a gesture SHALL still be reported as a hit and SHALL
still sound its drum. The existing rule that a message is matched as a pad
before it is matched as transport is unchanged: an instrument always plays its
drum, and a gesture is additional rather than a mute.

Where the instrument's corners are not known, no gesture SHALL be recognised.
Silence is correct: a guessed corner would fire the wrong action from a pad the
student was playing deliberately.

A gesture SHALL be reported whenever it is performed and the controller is
receiving messages. Where a surface has not yet acquired MIDI — browsers grant
it, like audio, only after a real click, and a MIDI message is not one — no
message arrives and so no gesture can be recognised. That is a property of the
surface, not of the controller.

A gesture SHALL be reported whenever it is performed. Deciding that a gesture is
unwanted at a particular moment belongs to the caller, not to the controller,
which knows what the device did and nothing about what is on screen.

#### Scenario: Opposite corners struck together are one gesture

- **WHEN** the bottom-left and top-right corner pads are struck within the recognition window
- **THEN** the controller reports the **again** gesture once
- **AND** both pads are also reported as hits and sound their drums

#### Scenario: The other diagonal is the other gesture

- **WHEN** the top-left and bottom-right corner pads are struck within the window
- **THEN** the controller reports the **next** gesture

#### Scenario: Two strikes too far apart are not a gesture

- **WHEN** two opposite corner pads are struck further apart than the recognition window
- **THEN** no gesture is reported
- **AND** each is reported as an ordinary hit

#### Scenario: Adjacent corners are not a gesture

- **WHEN** two corner pads that are not opposite each other are struck together
- **THEN** no gesture is reported

#### Scenario: An instrument with no known corners has no gestures

- **GIVEN** an instrument whose corners are not known
- **WHEN** any pair of its pads is struck together
- **THEN** no gesture is reported
- **AND** every strike is reported as an ordinary hit

#### Scenario: A surface that is not yet listening

- **GIVEN** a page that has not yet acquired MIDI access
- **WHEN** opposite corners are struck
- **THEN** no message reaches the page and no gesture is acted on

#### Scenario: A grid knows its own corners

- **GIVEN** a grid controller of known columns and rows
- **THEN** its four corner pads are those at the corners of that arrangement
- **AND** no declaration is required of it
