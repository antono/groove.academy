# quote-interstitial

## MODIFIED Requirements

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
