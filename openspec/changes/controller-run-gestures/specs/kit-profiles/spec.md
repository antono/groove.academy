# kit-profiles

## ADDED Requirements

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
