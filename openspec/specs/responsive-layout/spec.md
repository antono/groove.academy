# responsive-layout Specification

## Purpose

Defines how Groove Academy behaves below desktop width, so a student practising
with a phone propped up and both hands busy can navigate, start a lesson and
read their result with a thumb, on a screen that browser chrome and hardware
cutouts are constantly reshaping.

## Requirements

### Requirement: Collapsed navigation

Below the mobile breakpoint the site navigation SHALL collapse to a single
control in the header, and SHALL open as a full-screen panel rather than a
dropdown. Panel links SHALL be rendered at reading size and at full tap size,
not at the header's condensed size. At or above the breakpoint the navigation
SHALL remain the inline row of links, and the control SHALL NOT be shown.

#### Scenario: Narrow viewport collapses the nav

- **WHEN** the viewport is below the mobile breakpoint
- **THEN** the header shows the brand and a single menu control
- **AND** no navigation links are visible in the header

#### Scenario: Opening the menu covers the viewport

- **WHEN** the student activates the menu control
- **THEN** a panel covering the viewport shows every navigation link the student is entitled to see
- **AND** the link for the section currently being viewed is marked as current

#### Scenario: Header does not wrap instead of collapsing

- **WHEN** the viewport is 320px wide
- **THEN** the header occupies a single row
- **AND** the page does not scroll horizontally

#### Scenario: Debug links follow the same opt-in

- **WHEN** the debug opt-in is not set
- **THEN** the menu panel does not list the debug section
- **AND** when it is set, the panel lists it alongside the other links

### Requirement: Menu dismissal and focus

An open navigation panel SHALL be dismissible by an explicit close control, by
the Escape key, and by navigating to a route. While the panel is open, keyboard
focus SHALL be confined to it, and on close focus SHALL return to the control
that opened it. Content behind the panel SHALL NOT scroll while it is open.

#### Scenario: Escape closes the menu

- **WHEN** the panel is open and the student presses Escape
- **THEN** the panel closes and focus returns to the menu control

#### Scenario: Navigating closes the menu

- **WHEN** the student activates a link in the panel
- **THEN** the destination is shown with the panel closed

#### Scenario: Focus stays inside the open panel

- **WHEN** the panel is open and the student tabs past its last focusable element
- **THEN** focus moves to the panel's first focusable element rather than to the page behind it

### Requirement: Navigable blocks are tappable whole

Every block that represents a single navigation destination SHALL be activatable
across its whole visible area, not only on its title or a trailing link. This
SHALL apply to tier entries, stage entries, lesson cards and news entries. A
block SHALL expose exactly one link to its destination, so assistive technology
and history record one target rather than several.

#### Scenario: Tapping a card body navigates

- **WHEN** the student taps a tier, stage, lesson or news block anywhere other than on a nested control
- **THEN** they navigate to that block's destination

#### Scenario: A block is one link, not many

- **WHEN** a navigable block is inspected
- **THEN** it exposes a single link to its destination with an accessible name identifying it

#### Scenario: Non-navigable blocks stay inert

- **WHEN** a block represents a planned lesson slot or a locked tier
- **THEN** tapping it navigates nowhere
- **AND** it is visibly distinguished from a navigable block

### Requirement: Touch target size

Interactive controls SHALL present a touch target of at least 44 by 44 CSS
pixels on a coarse pointer, including the tempo slider's thumb, transport
buttons, the statistics range controls and the navigation menu control. Where a
control's visible size is smaller by design, its target SHALL be enlarged
without changing what is drawn.

#### Scenario: Controls meet the minimum target

- **WHEN** any interactive control is measured on a coarse-pointer device
- **THEN** its activatable area is at least 44 by 44 CSS pixels

### Requirement: Full-screen result on mobile

Below the mobile breakpoint the result screen of a scored run SHALL occupy the
whole viewport, its content SHALL scroll within itself, and its actions SHALL
remain reachable without scrolling. Above the breakpoint it SHALL remain a
floating card over the highway. In both cases it SHALL remain an overlay over
the frozen run: showing or dismissing it SHALL NOT reflow the page beneath.

#### Scenario: Result fills a phone screen

- **WHEN** a run is scored on a viewport below the mobile breakpoint
- **THEN** the result occupies the full viewport
- **AND** its actions are reachable without scrolling the result

#### Scenario: Long results scroll inside the sheet

- **WHEN** the result's per-pad breakdown is taller than the viewport
- **THEN** the breakdown scrolls within the result
- **AND** the page behind it does not scroll

#### Scenario: Showing the result does not reflow the page

- **WHEN** a run finishes and when its result is dismissed
- **THEN** the layout beneath the overlay does not shift

### Requirement: Viewport-fitting height

Any element sized to the full height of the screen SHALL use the viewport height
that excludes retracted browser chrome, so that content anchored to the bottom
of the screen is not pushed out of view on a mobile browser.

#### Scenario: Footer is reachable with chrome shown

- **WHEN** a short page is viewed on a mobile browser with its chrome expanded
- **THEN** the footer sits at the bottom of the visible area, not below it

#### Scenario: The run fills the visible area

- **WHEN** a run is playing on a mobile browser
- **THEN** the highway and its transport occupy the visible viewport with no content clipped by browser chrome

### Requirement: Safe area insets

Content SHALL be kept clear of display cutouts and system gesture areas. The
full-screen run — its highway, its transport controls and its on-screen pads —
and the full-screen navigation panel and result SHALL respect the device's safe
area insets on every edge.

#### Scenario: Transport clears the home indicator

- **WHEN** a run is playing on a device with a bottom gesture area
- **THEN** the transport controls and on-screen pads sit above that area and remain fully tappable

#### Scenario: Overlays clear a notch

- **WHEN** a full-screen overlay is shown on a device with a display cutout
- **THEN** no text or control is obscured by the cutout

### Requirement: Touch behaviour during a run

On-screen pads and transport controls SHALL respond to every tap as a discrete
input. Rapid repeated taps SHALL NOT trigger the browser's double-tap zoom, and
dragging across a pad SHALL NOT select text or begin a text selection.

#### Scenario: Fast repeated taps register as hits

- **WHEN** a student taps a pad twice in quick succession during a run
- **THEN** two hits are registered
- **AND** the page does not zoom

#### Scenario: Pads do not select as text

- **WHEN** a student drags a finger across the on-screen pads
- **THEN** no text selection appears

### Requirement: No horizontal page scroll

No page SHALL scroll horizontally at a viewport width of 320 CSS pixels. Content
that is wider than the viewport by nature — the practice heatmap, trend charts,
wide tables — SHALL scroll within its own container.

#### Scenario: Pages fit the narrowest supported width

- **WHEN** any route is viewed at 320px wide
- **THEN** the document does not scroll horizontally

#### Scenario: Wide charts scroll in place

- **WHEN** the practice heatmap or a trend chart is wider than the viewport
- **THEN** it scrolls horizontally inside its own container
- **AND** the surrounding page does not move

### Requirement: Narrow-width statistics and setup

The statistics page and the setup wizard SHALL remain usable at phone width.
Statistics tiles, the range control and the runs table SHALL reflow to a single
column. The wizard SHALL keep the current step, its instruction and its controls
visible without horizontal scrolling, and the controller preview SHALL scale to
the available width.

The wizard's **progress rail** SHALL remain legible at every width at which it
shows labels: a step label SHALL NOT overlap another label or any step marker.
Where the flow has more steps than fit, the rail SHALL name only the current step
and let the markers carry the count, rather than allowing labels to collide.

The widths that matter are the ones where labels are actually drawn. Below the
rail's own label breakpoint the labels are hidden entirely, so an overlap check
there is vacuous; what must hold at phone width instead is that the markers and
connecting lines do not overflow the rail or scroll the page.

#### Scenario: Statistics reflow to one column

- **WHEN** the statistics page is viewed below the mobile breakpoint
- **THEN** its tiles, range control and runs table are laid out in a single column and are readable without zooming

#### Scenario: The wizard fits a phone

- **WHEN** any step of the setup wizard is viewed below the mobile breakpoint
- **THEN** the current step's name, its instruction and its controls are visible without horizontal scrolling
- **AND** the controller preview fits the available width

#### Scenario: The progress rail does not collide with itself

- **WHEN** a flow's progress rail is viewed at a width where it draws labels, including just above its label breakpoint
- **THEN** no step label overlaps another label or a step marker

#### Scenario: The rail's markers fit a phone

- **WHEN** a flow's progress rail is viewed at 390px and at 320px
- **THEN** its markers and connecting lines fit within the rail without overflowing
- **AND** the page does not scroll horizontally

#### Scenario: A long flow's rail degrades to markers

- **WHEN** the rail has more steps than can be labelled at the available width
- **THEN** only the current step is named and the remaining steps are shown as markers

### Requirement: Portrait orientation

The scored run SHALL be playable in portrait orientation, not only landscape.
Where landscape gives a materially better view of the highway, the app MAY
suggest rotating, but SHALL NOT require it or block play until the device is
rotated. A change of orientation during a run SHALL NOT end or restart the run.

#### Scenario: A run is playable in portrait

- **WHEN** a student starts a run on a phone held in portrait
- **THEN** the highway, transport and on-screen pads are all usable

#### Scenario: Rotating mid-run keeps the run

- **WHEN** the device is rotated during a run
- **THEN** the run continues and the layout adapts to the new orientation

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
