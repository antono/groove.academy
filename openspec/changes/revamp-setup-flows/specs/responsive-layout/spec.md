## MODIFIED Requirements

### Requirement: Narrow-width statistics and setup

The statistics page and the setup wizard SHALL remain usable at phone width.
Statistics tiles, the range control and the runs table SHALL reflow to a single
column. The wizard SHALL keep the current step, its instruction and its controls
visible without horizontal scrolling, and the controller preview SHALL scale to
the available width.

The wizard's **progress rail** SHALL remain legible at phone width: its step
labels SHALL NOT overlap each other or its step markers. Where the flow has more
steps than fit, the rail SHALL name only the current step and let the markers
carry the count, rather than allowing labels to collide.

#### Scenario: Statistics reflow to one column

- **WHEN** the statistics page is viewed below the mobile breakpoint
- **THEN** its tiles, range control and runs table are laid out in a single column and are readable without zooming

#### Scenario: The wizard fits a phone

- **WHEN** any step of the setup wizard is viewed below the mobile breakpoint
- **THEN** the current step's name, its instruction and its controls are visible without horizontal scrolling
- **AND** the controller preview fits the available width

#### Scenario: The progress rail does not collide with itself

- **WHEN** a flow's progress rail is viewed at 390px wide
- **THEN** no step label overlaps another label or a step marker

#### Scenario: A long flow's rail degrades to markers

- **WHEN** the rail has more steps than can be labelled at the available width
- **THEN** only the current step is named and the remaining steps are shown as markers

## ADDED Requirements

### Requirement: The header instrument chip fits the collapsed header

The header's instrument chip SHALL coexist with the collapsed navigation control
without causing the header to wrap or the page to scroll horizontally.

Below the mobile breakpoint the chip MAY reduce to a compact form that shows the
instrument's connected state without its full name, but SHALL remain a tap target
of the size this specification requires of navigable blocks, and its full name
SHALL remain available to assistive technology.

The chip's dropdown SHALL be reachable and dismissable at phone width by the same
rules as the navigation panel.

#### Scenario: The chip does not wrap the header at 320px

- **WHEN** the viewport is 320px wide and an instrument is configured
- **THEN** the header occupies a single row containing the brand, the chip and the menu control
- **AND** the page does not scroll horizontally

#### Scenario: The compact chip keeps its meaning

- **WHEN** the chip is shown in its compact form
- **THEN** whether the instrument is connected is still conveyed
- **AND** the instrument's name is available to assistive technology

#### Scenario: The chip is tappable whole

- **WHEN** the chip is shown below the mobile breakpoint
- **THEN** its tap target meets the minimum touch target size
