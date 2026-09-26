# Tasks

## 1. Corners

- [ ] 1.1 Add an optional corner declaration to `KitProfile`, naming four of its own pad ids
- [ ] 1.2 Treat a partial declaration as none — three corners describe no diagonal
- [ ] 1.3 Declare the NUX DP-2000's corners: kick and ride on one diagonal, tom-1 and hihat-open on the other
- [ ] 1.4 Compute a grid's corners from its columns and rows, with nothing declared
- [ ] 1.5 Expose the resolved corners on the Controller, `null` where unknown
- [ ] 1.6 Extend `scripts/check-kits.py` so a declared corner naming a pad the profile lacks fails `pnpm check`

## 2. Recognition

- [ ] 2.1 Add `again` and `next` as an optional `gesture` field on the `hit` event
- [ ] 2.2 Remember the last corner struck and when, consulted only for a corner note
- [ ] 2.3 Complete a gesture on the second strike, only across opposite corners
- [ ] 2.4 Ignore adjacent-corner and same-corner pairs
- [ ] 2.5 Keep every hit reported and every drum sounded — the no-debounce rule is untouched
- [ ] 2.6 Report a gesture whenever performed; the Controller learns nothing about lessons

## 3. Routing on the lesson page

- [ ] 3.1 Ignore gestures entirely while `playing`
- [ ] 3.2 At rest: `again` starts the run, `next` does nothing
- [ ] 3.3 On the result screen: `again` restarts, `next` goes to the next lesson
- [ ] 3.4 While the quote interstitial is showing: either gesture advances, unrated, quote still marked seen
- [ ] 3.5 Confirm `quote-of-the-day.svelte` needs no change; if it does, say why in the commit

## 4. The window

- [ ] 4.1 Implement the recognition window as one named constant, default 150 ms
- [ ] 4.2 Measure it on a real kit: strike opposite corners together a dozen times, read the spread
- [ ] 4.3 Confirm DP-2000 crosstalk cannot complete a gesture — it travels between adjacent pads, not opposite corners
- [ ] 4.4 Settle the constant against that measurement rather than leaving the default

## 5. Verification

- [ ] 5.1 Both gestures recognised on the DP-2000, repeatedly, by someone not aiming carefully
- [ ] 5.2 Opposite corners outside the window are two ordinary hits and no gesture
- [ ] 5.3 Adjacent corners never produce a gesture
- [ ] 5.4 Both corner pads still sound their drums when a gesture fires
- [ ] 5.5 No gesture has any effect during a run, at any tempo
- [ ] 5.6 A profile with no declared corners has no gestures and is otherwise fully usable
- [ ] 5.7 Start a lesson, restart it, and reach the next one without touching the screen
- [ ] 5.8 A gesture past the quote records no rating, and the quote stays marked seen
- [ ] 5.9 `pnpm check` clean
