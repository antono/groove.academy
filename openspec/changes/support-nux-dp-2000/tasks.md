# Tasks

## 1. Hardware measurement

- [x] 1.1 Identify the MIDI port name and manufacturer as the browser reports them
- [x] 1.2 Capture the note each of the eight pads sends
- [x] 1.3 Confirm the notes do not follow the selected kit (kits "Pop" and "Studio")
- [x] 1.4 Record which drum the module plays for each pad
- [x] 1.5 Confirm the factory values via `RESET SYSTEM`, twice
- [x] 1.6 Establish that the panel buttons and encoders transmit nothing

## 2. Schematic

- [x] 2.1 Draw `static/kits/nux-dp-2000.svg` — eight pads, two rows of four, control strip on top
- [x] 2.2 Give every drum a `<g id>` matching its pad id, with an empty `<text class="label">`
- [x] 2.3 Confirm `scripts/check-kits.py` passes in both directions

## 3. Profile

- [x] 3.1 Add `note?` to `KitPad` for a measured factory default
- [x] 3.2 Add `gmNotes?` to `KitProfile`, defaulting to the existing behaviour
- [x] 3.3 Add the `nux-dp-2000` profile, matching on the port name only
- [x] 3.4 Record the measurement and the manual's disagreement in the profile comment

## 4. Behaviour

- [x] 4.1 Seed pad notes from the profile in `Controller.fromProfile`
- [x] 4.2 Derive `notesAreGm` from the matched profile in the MIDI flow
- [x] 4.3 Apply it to both adoption paths (capture loop and the pedals/kick path)
- [x] 4.4 `pnpm check` clean

## 5. Verification

- [x] 5.1 Autodetection resolves the live port to `nux-dp-2000`
- [x] 5.2 A bare Focusrite interface still matches nothing
- [x] 5.3 `millenium-md-90` still matches its own device
- [x] 5.4 All eight pads resolve to the right drum through `Controller.handle()` on live hardware
- [x] 5.5 `canPlay` / `missing` report a playable kit, with only a crash absent
- [x] 5.6 Walk the setup wizard end to end on the real kit and confirm the saved controller is correct
- [x] 5.7 Play a scored lesson and confirm hits register as intended rather than as extras

## 6. Follow-ups (not this change)

- [ ] 6.1 Consider whether `millenium-md-90`'s manufacturer-based pattern carries the same contamination risk
- [ ] 6.2 Note trigger crosstalk as a module setting where a student would meet it
- [ ] 6.3 Lessons needing three simultaneous hits are unplayable on a stick kit with
      no pedal — 27 of 92 lessons. Tracked as its own change (`limb-aware-playability`)
