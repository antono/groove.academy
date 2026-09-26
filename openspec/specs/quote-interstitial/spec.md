# quote-interstitial Specification

## Purpose

TBD - created by archiving change quote-of-the-day. Update Purpose after archive.

## Requirements

### Requirement: Quote collection with stable ids

The system SHALL ship the quote collection as a static JSON asset in which every
quote carries a stable, unique identifier that does not change when quotes are
added, removed, or reordered. Each quote entry MUST expose its citation text, its
author, and the author testimonial (the source/reference prose).

#### Scenario: Every quote has a unique stable id

- **WHEN** the quote collection is loaded
- **THEN** each quote has a unique identifier
- **AND** no two quotes share an identifier
- **AND** the identifier for a given quote is unchanged after other quotes are
  added or reordered

#### Scenario: A quote exposes citation, author, and testimonial

- **WHEN** a quote is selected for display
- **THEN** its citation text, author name, and author testimonial are all
  available to the UI

### Requirement: Full-screen centered quote presentation

The system SHALL present the selected quote full-screen, centered both
vertically and horizontally, showing the citation and the author's name.

#### Scenario: Quote is centered full-screen

- **WHEN** the interstitial is shown
- **THEN** the citation and author fill the screen and are centered vertically
  and horizontally

#### Scenario: Author testimonial revealed on hover or click

- **WHEN** the user hovers over or clicks the author's name
- **THEN** the author's testimonial (reference prose) is revealed
- **AND** it is not shown until the user hovers or clicks

### Requirement: Random selection preferring unseen quotes

The system SHALL select a quote at random, preferring quotes the user has not yet
seen, and MUST remember which quotes a user has seen across sessions on that
device.

#### Scenario: An unseen quote is preferred

- **WHEN** the interstitial is shown and at least one quote has not been seen
- **THEN** the displayed quote is chosen at random from the unseen quotes
- **AND** it is marked as seen

#### Scenario: Seen set persists across sessions

- **WHEN** a user has seen some quotes and returns in a later session on the same
  device
- **THEN** those quotes remain marked as seen

### Requirement: Interstitial on the result screen "Next lesson"

The system SHALL show the quote interstitial when the user presses "Next lesson"
on a scored run's result screen, and MUST advance to the next lesson only after
the user rates the quote, dismisses the interstitial, or performs a corner
gesture on their instrument.

A corner gesture SHALL advance to the next lesson **without recording a rating**.
Either gesture SHALL do so. A student who skipped past a quotation has not formed
an opinion about it, and banking one would corrupt the ratings with the
preferences of people who were reaching for the next lesson.

The quote SHALL still be marked as seen, because it was shown.

#### Scenario: Quote appears before navigating to the next lesson

- **WHEN** a user finishes a scored run and presses "Next lesson"
- **THEN** the full-screen quote is shown instead of navigating immediately
- **AND** navigation to the next lesson is deferred until the user acts

#### Scenario: Like or dislike advances to the next lesson

- **WHEN** the user selects like or dislike on the interstitial
- **THEN** the rating is recorded
- **AND** the app navigates to the next lesson

#### Scenario: A gesture advances without rating

- **WHEN** the user performs either corner gesture while the interstitial is shown
- **THEN** the app navigates to the next lesson
- **AND** no rating is recorded
- **AND** the quote remains marked as seen

### Requirement: "Never show quotes" preference

The system SHALL provide a "never show quotes" control at the bottom of the
interstitial that, when set, instantly dismisses the current quote, navigates
straight to the next lesson, and suppresses the interstitial thereafter. This
preference is device-local.

#### Scenario: Opting out skips immediately

- **WHEN** the user checks "never show quotes"
- **THEN** the interstitial is dismissed immediately without requiring a rating
- **AND** the app navigates to the next lesson

#### Scenario: Opt-out is remembered

- **WHEN** a user who opted out later presses "Next lesson" on a result screen
- **THEN** no interstitial is shown and navigation proceeds directly

### Requirement: Restart the cycle once all quotes are seen

The system SHALL restart the cycle from the beginning once the user has seen
every quote in the collection at least once: the seen set is cleared and
subsequent quotes are again drawn from the full collection, preferring unseen
quotes within the new cycle.

#### Scenario: Cycle restarts after all quotes seen

- **WHEN** the user has seen every quote in the collection and presses "Next
  lesson"
- **THEN** the seen set is reset
- **AND** the interstitial shows again, drawing from the full collection

#### Scenario: No immediate repeat across the cycle boundary

- **WHEN** the cycle restarts
- **THEN** the interstitial continues to prefer quotes not yet seen in the new
  cycle
