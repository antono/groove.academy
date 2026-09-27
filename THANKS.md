# Thanks & Attributions

Groove Academy ships pre-rendered audio one-shots extracted from the SoundFonts below.
This file credits each source, what was taken, its license, and the authors.
(Regenerate the samples with the scripts in `scripts/`.)

**On licensing.** The project's own work — the code, the curriculum and its MIDIs,
the prose, the schematics and the artwork — is public domain under CC0 1.0; see
[`LICENSE`](LICENSE). Two things here are excluded from that, because they were
never the project's to give away:

- **The drum samples** (`static/drums/`), whose SoundFont states no licence of its
  own. Rights never granted cannot be passed on. The bass samples are unaffected:
  FreePats releases them CC0, so they are public domain twice over.
- **The quotations** (`docs/groove_academy_quotes.csv`,
  `static/quotes/quotes.json`). The words belong to the people who said them, and
  are used here attributed and sourced. The selection and citations are the
  project's own and are covered by CC0.

Anyone wanting a wholly unencumbered copy can re-render the drums from a SoundFont
of their own choosing with `scripts/render-drums.py` — the renderer, the level
table and the fallback logic are all CC0.

---

## Drums — "The Definitive Perfect Drums Soundfont (V1, Mapped)"

- **Samples taken:** every GM percussion note (MIDI 35–70) of all 12 kits,
  rendered to `static/drums/kit<N>/<note>.oga` via `scripts/render-drums.py`.
- **Not in the SoundFont:** three notes have no key zone and render as silence, so
  they are derived from other samples in the same bank rather than taken from it —
  47 "LoMid Tom" (45 Lo Tom, resampled up two semitones), 68 "Lo Agogo" (67 Hi
  Agogo, down a major third), and 39 "Hand Clap" on kits 7–12 (kit 6's clap).
- **Authors:** lukinhas, TEC Again.
- **Source file:** `soundfonts/Perfect_Drums.sf2`.
- **License:** not specified by the SoundFont (community/GM percussion bank).
  If you know the intended license, please open an issue so this can be updated.

---

## Bass — FreePats (all CC0 1.0 Public Domain)

The bass backing sounds come from the [FreePats project](https://freepats.zenvoid.org/),
each released under the
[Creative Commons CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
public domain dedication. Attribution is not legally required — it is given here
with thanks.

- **Samples taken (all basses):** notes MIDI 28–60 (E1–C4), rendered to
  `static/bass/<id>/<note>.oga` via `scripts/render-bass.py`. The two electric
  basses are real recordings and cover only the instrument's own range (picked
  28–46, finger 28–45); notes outside it are not shipped.

### Lately Bass

- **What it is:** simulation of the Yamaha TX81Z "Lately Bass" patch (made with Dexed).
- **Author:** Yingchun Soul (迎春心情), adapted for FreePats.
- **Source file:** `soundfonts/LatelyBass.sf2`
  ([download](https://github.com/freepats/lately-bass)).
- **License:** CC0 1.0 (public domain).

### Synth Bass 1

- **What it is:** bass recorded from the ZynAddSubFX / Yoshimi software synthesizers.
- **Author:** roberto@zenvoid.org, for the FreePats project.
- **Source file:** `soundfonts/SynthBass1.sf2`
  ([download](https://github.com/freepats/synth-bass-1)).
- **License:** CC0 1.0 (public domain).

### Synth Bass 2

- **What it is:** imitation of the Yamaha DX7 "BASS 1" patch (recorded from Hexter).
- **Author:** roberto@zenvoid.org, for the FreePats project.
- **Source file:** `soundfonts/SynthBass2.sf2`
  ([download](https://github.com/freepats/synth-bass-2)).
- **License:** CC0 1.0 (public domain).

### Picked Bass

- **What it is:** a real Yamaha RBX bass guitar, played with a pick
  ("Picked Bass YR").
- **Author:** Andrea Biasior, with edits by roberto@zenvoid.org for FreePats.
- **Source file:** `soundfonts/PickedBassYR.sf2`
  ([download](https://github.com/freepats/electric-bass-YR)).
- **License:** CC0 1.0 (public domain).

### Finger Bass

- **What it is:** the same Yamaha RBX bass guitar, played fingerstyle
  ("Finger Bass YR").
- **Author:** Andrea Biasior, with edits by roberto@zenvoid.org for FreePats.
- **Source file:** `soundfonts/FingerBassYR.sf2`
  ([download](https://github.com/freepats/electric-bass-YR)).
- **License:** CC0 1.0 (public domain).
