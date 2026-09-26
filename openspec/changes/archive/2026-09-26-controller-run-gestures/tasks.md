# Tasks

## 1. Corners

- [x] 1.1 Add an optional corner declaration to `KitProfile`, naming four of its own pad ids
- [x] 1.2 Treat a partial declaration as none — three corners describe no diagonal
- [x] 1.3 Declare the NUX DP-2000's corners: kick and ride on one diagonal, tom-1 and hihat-open on the other
- [x] 1.4 Compute a grid's corners from its columns and rows, with nothing declared
- [x] 1.5 Expose the resolved corners on the Controller, `null` where unknown
- [x] 1.6 Extend `scripts/check-kits.py` so a declared corner naming a pad the profile lacks fails `pnpm check`

## 2. Recognition

- [x] 2.1 Add `again` and `next` as an optional `gesture` field on the `hit` event
- [x] 2.2 Remember the last corner struck and when, consulted only for a corner note
- [x] 2.3 Complete a gesture on the second strike, only across opposite corners
- [x] 2.4 Ignore adjacent-corner and same-corner pairs
- [x] 2.5 Keep every hit reported and every drum sounded — the no-debounce rule is untouched
- [x] 2.6 Report a gesture whenever performed; the Controller learns nothing about lessons

## 3. Routing on the lesson page

- [x] 3.1 Ignore gestures entirely while `playing`
- [x] 3.2 At rest: `again` starts the run, `next` does nothing
- [x] 3.3 On the result screen: `again` restarts, `next` goes to the next lesson
- [x] 3.4 While the quote interstitial is showing: either gesture advances, unrated, quote still marked seen
- [x] 3.5 Confirmed `quote-of-the-day.svelte` needs no change — `markSeen()` runs at selection, and `setRating` is reachable only from the like/dislike buttons

## 4. The window

- [x] 4.1 Implement the recognition window as one named constant, default 150 ms
- [x] 4.2 Tried on a real kit — 150 ms recognises comfortably without aiming
- [x] 4.3 Crosstalk dismissed: bleed travels between adjacent pads, and neither diagonal on this kit is an adjacent pair
- [x] 4.4 Constant settled at the 150 ms default

## 5. Verification

- [x] 5.1 Both gestures recognised on the DP-2000, repeatedly, by someone not aiming carefully — verified once the page has audio; a cold load receives no MIDI at all, which the spec now states
- [x] 5.2 Opposite corners outside the window are two ordinary hits and no gesture
- [x] 5.3 Adjacent corners never produce a gesture
- [x] 5.4 Both corner pads still sound their drums when a gesture fires
- [x] 5.5 No gesture has any effect during a run, at any tempo
- [x] 5.6 A profile with no declared corners has no gestures and is otherwise fully usable
- [x] 5.7 Start a lesson, restart it, and reach the next one without touching the screen — restart and next confirmed on the result screen; start at rest blocked, see 5.1
- [x] 5.8 A gesture past the quote records no rating, and the quote stays marked seen
- [x] 5.9 `pnpm check` clean
