#!/usr/bin/env python3
"""Generate the lesson MIDIs and static/lessons/manifest.json.

The curriculum lives in `scripts/lessons/` — one Python module per stage, each
exporting a `STAGE` built from `lessons/schema.py`. This file is only the
driver: it walks that structure, numbers it, writes a format-1 MIDI per playable
lesson, and emits the manifest the app reads.

Layout on disk:

    static/lessons/
      manifest.json
      stage-01-pulse/kick-quarters.mid
      stage-02-backbeat/backbeat-plain.mid

Filenames carry the **slug only** — never a number. Order lives in the manifest
and nowhere else, so inserting a lesson is a one-line change instead of a rename
cascade, and a lesson that moves stages keeps its id, its practice history and
its remembered tempo.

Track roles are chosen by the track name:
  - "drums"        -> playable: shown on the highway and scored.
  - "family:id"    -> backing:  auto-played from static/<family>/<id>/<note>.oga
                      (e.g. "bass:lately"), never shown or scored.
  - "count-in"     -> the stick count that leads the student in; audible but
                      never shown or scored (see COUNT-IN RULE below).
  - "guide"        -> the borrowed hi-hat a hatless lesson keeps time against;
                      audible but never shown or scored (see GUIDE-HAT RULE).

COUNT-IN RULE: every lesson must have three stick clicks before it starts, on
the last three beats of the lead-in bar. Nothing clicks on the pattern's first
beat — that one is the student's. build_lesson() adds the track to every lesson
automatically, so a new entry gets it for free — do not hand-roll one per
lesson, and do not remove it.

CLOSING-HIT RULE: a pattern ends ON the bar line that follows it, not a beat
before. Whatever sounds on beat 0 sounds once more on the down-beat after the
last bar, so the phrase lands instead of running out; the bass resolves onto
that same beat (see bass.resolved) and the two finish together. build_lesson()
adds it to every lesson — it is scored, and the transport runs a beat past it
so it can be played.

GUIDE-HAT RULE: a lesson whose pattern has no timekeeper of its own gets a
hi-hat added, playing 8ths underneath at low velocity. On a kit the hat is the
voice that never stops and everything else is heard against it; without one the
student is counting in silence between their own hits. build_lesson() detects
the absence and adds the track. A pattern that already plays a hat — or a ride,
which does the same job — is left alone; a lesson that wants a different
timekeeper should put a real one in its pattern.

Re-run after adding or editing a lesson:
  python3 scripts/make-lessons.py
"""

import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lessons import CURRICULUM, TIERS  # noqa: E402
from lessons.grids import close_on_downbeat, guide_hats  # noqa: E402
from lessons.midi import (  # noqa: E402
    CLOSED_HH,
    OPEN_HH,
    RIDE,
    build_track,
    count_in_sticks,
    max_voices,
    notes_in,
    write_midi,
)

# A lesson already keeps its own time if it strikes any of these. The rule is
# about the *job*, not the pad: a ride playing 8ths is the voice that never
# stops just as much as a hat is, and adding a guide hat under one would put two
# timekeepers in the same bar. A crash is not on this list — it is an accent, and
# a pattern that only crashes still has nothing running underneath it.
TIMEKEEPER_NOTES = {CLOSED_HH, OPEN_HH, RIDE}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "static", "lessons")


PRINT_WIDTH = 80  # prettier's default


def render(value, indent=0):
    """JSON the way prettier writes it, so regenerating is never a diff.

    `json.dump(indent=2)` explodes every array onto its own lines; prettier
    keeps one on a single line when it fits inside the print width, so the two
    disagree on `"prereq": ["kick-quarters"]` and the pre-commit hook rewrites
    the file every run. Objects always expand — prettier does not join them
    back up — so only arrays need the width test.
    """
    pad = " " * indent
    inner = " " * (indent + 2)
    if isinstance(value, dict):
        if not value:
            return "{}"
        items = [
            f"{inner}{json.dumps(k, ensure_ascii=False)}: {render(v, indent + 2)}"
            for k, v in value.items()
        ]
        return "{\n" + ",\n".join(items) + f"\n{pad}}}"
    if isinstance(value, list):
        if not value:
            return "[]"
        flat = "[" + ", ".join(render(v) for v in value) + "]"
        if "\n" not in flat and indent + len(flat) <= PRINT_WIDTH:
            return flat
        items = [f"{inner}{render(v, indent + 2)}" for v in value]
        return "[\n" + ",\n".join(items) + f"\n{pad}]"
    return json.dumps(value, ensure_ascii=False)


def stage_dir(stage):
    return f"stage-{stage['number']:02d}-{stage['slug']}"


def bass_ranges():
    """Per-bass rendered ranges from the manifest, or None if it never ran.

    Not every bass covers the same notes: the electric basses are real
    recordings and stop where the instrument's neck does, while the synths run
    the full span. `render-bass.py` audits every render and writes each bass's
    true range, which is what a line has to be checked against — the global
    span would pass a note the chosen bass cannot play.
    """
    try:
        with open(os.path.join(ROOT, "static", "bass", "manifest.json")) as f:
            man = json.load(f)
        return {
            b["id"]: (b.get("lo", man["lo"]), b.get("hi", man["hi"]))
            for b in man["basses"]
        }
    except (OSError, KeyError, ValueError):
        return None


def check_bass_range(lesson, bass_id, events):
    """Fail on a bass note that was never rendered.

    A backing note outside the rendered range is a 404 at playback and nothing
    else: no error the student sees, no gap in the drums, just a line quietly
    missing some of its notes. It is invisible in the MIDI, invisible on the
    chart (backing is never drawn), and only shows up in the dev server's log —
    so it gets caught here, where the line is written.
    """
    ranges = bass_ranges()
    if ranges is None:
        return  # samples not rendered on this machine; nothing to check against
    if bass_id not in ranges:
        raise SystemExit(f"{lesson['slug']}: bass '{bass_id}' was never rendered")
    lo, hi = ranges[bass_id]
    out = sorted(
        {raw[1] for _t, _o, raw in events if raw[0] & 0xF0 == 0x90 and raw[2]}
        - set(range(lo, hi + 1))
    )
    if out:
        raise SystemExit(
            f"{lesson['slug']}: bass '{bass_id}' plays {out}, "
            f"outside its rendered range {lo}-{hi}"
        )


def build_lesson(lesson, out_dir, rel_dir):
    """Write one lesson's MIDI and return the fields derived from it."""
    bars = lesson["bars"]
    tempo = int(round(60_000_000 / lesson["bpm"]))
    conductor_meta = [
        (0, -3, bytes([0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08])),  # 4/4
        (0, -2, bytes([0xFF, 0x51, 0x03]) + tempo.to_bytes(3, "big")),  # tempo
    ]

    drum_events, length = lesson["drums"](bars)
    # Land the pattern on the next bar line — see CLOSING-HIT RULE above.
    drum_events, length = close_on_downbeat(drum_events, bars)
    count_events, count_length = count_in_sticks()
    tracks = [
        build_track("tempo", [], length, meta=conductor_meta),
        build_track("drums", drum_events, length),
        # Every lesson counts in — see COUNT-IN RULE at the top of this file.
        build_track("count-in", count_events, count_length),
    ]
    # A lesson with no timekeeper of its own borrows one — see GUIDE-HAT RULE.
    if not notes_in(drum_events) & TIMEKEEPER_NOTES:
        guide_events, _ = guide_hats(bars)
        tracks.append(build_track("guide", guide_events, length))
    if lesson.get("bass"):
        bass_id, builder = lesson["bass"]
        bass_events, _ = builder(bars)
        check_bass_range(lesson, bass_id, bass_events)
        tracks.append(build_track(f"bass:{bass_id}", bass_events, length))

    write_midi(os.path.join(out_dir, f"{lesson['slug']}.mid"), tracks)
    return {
        "file": f"{rel_dir}/{lesson['slug']}.mid",
        # Derived here rather than re-read from the MIDI so it cannot disagree
        # with what the highway plays — the same reason the catalogue's chart is
        # rendered from the lesson's own MIDI.
        "voices": max_voices(drum_events),
    }


def tier_local_numbers():
    """Map each stage's global number to its position within its own tier.

    Stages are numbered from 1 inside each tier — Foundations reads Stage 1, 2,
    Vocabulary starts again at Stage 1 — rather than straight through the whole
    curriculum, because in the drill-down catalogue a student is always inside a
    tier and a global "Stage 3 · Subdivision" reads oddly. Position is taken over
    the stages that actually exist, so inserting an earlier stage shifts the ones
    after it — the same positional rule the lesson numbers already follow.
    """
    tier_of = {sn: t["slug"] for t in TIERS for sn in t["stages"]}
    counters, local = {}, {}
    for stage in CURRICULUM:
        slug = tier_of.get(stage["number"])
        counters[slug] = counters.get(slug, 0) + 1
        local[stage["number"]] = counters[slug]
    return local


def walk(local):
    """Yield every declared slot in curriculum order, numbered.

    A stage's lessons are numbered straight through it — modules are headings,
    not numbers — so a student says "1.4", never "1.2.1". The stage part is
    tier-local (see `tier_local_numbers`).
    """
    for stage in CURRICULUM:
        position = 0
        num = local[stage["number"]]
        for mod in stage["modules"]:
            for entry in mod["lessons"]:
                position += 1
                yield stage, mod, entry, f"{num}.{position}"
        if stage.get("closing"):
            yield stage, None, stage["closing"], f"{num}.◆"


def check(entries):
    """Fail loudly on the two mistakes that are easy to make and hard to see."""
    slugs = [e["slug"] for _s, _m, e, _n in entries]
    dupes = {s for s in slugs if slugs.count(s) > 1}
    if dupes:
        raise SystemExit(f"duplicate lesson slugs: {sorted(dupes)}")
    # `tier`, `stage` and `continue` name the catalogue's navigation routes
    # (/lessons/tier/…, /lessons/stage/…, /lessons/continue); a lesson at
    # /lessons/<slug> must never be able to shadow them.
    reserved = {"tier", "stage", "continue"} & set(slugs)
    if reserved:
        raise SystemExit(f"reserved lesson slugs: {sorted(reserved)}")
    known = set(slugs)
    for _stage, _mod, entry, number in entries:
        missing = [p for p in entry.get("prereq", []) if p not in known]
        if missing:
            raise SystemExit(f"{number} {entry['slug']}: unknown prereq {missing}")


def main():
    local = tier_local_numbers()
    entries = list(walk(local))
    check(entries)

    # A stale MIDI from a renamed lesson would keep being served, so the tree is
    # rebuilt rather than written over.
    for name in os.listdir(OUT) if os.path.isdir(OUT) else []:
        path = os.path.join(OUT, name)
        if os.path.isdir(path) and name.startswith("stage-"):
            shutil.rmtree(path)
        elif name.endswith(".mid"):
            os.remove(path)

    lessons = []
    for stage, mod, entry, number in entries:
        if entry.get("planned"):
            continue
        rel_dir = stage_dir(stage)
        out_dir = os.path.join(OUT, rel_dir)
        os.makedirs(out_dir, exist_ok=True)
        built = build_lesson(entry, out_dir, rel_dir)
        lessons.append(
            {
                "id": entry["slug"],
                "number": number,
                "name": entry["name"],
                "file": built["file"],
                "stage": stage["slug"],
                "module": mod["slug"] if mod else None,
                "tier": entry["tier"],
                "bpm": entry["bpm"],
                "bars": entry["bars"],
                # How many hits land together — how many limbs this lesson asks
                # for. Read against the student's stated voice count.
                "voices": built["voices"],
                "prereq": entry["prereq"],
                "summary": entry["summary"],
                "description": entry["description"],
                "hints": entry["hints"],
            }
        )

    # The outline the catalogue renders its headings from, planned slots
    # included: a student should be able to see the road ahead, greyed out.
    numbers = {e["slug"]: n for _s, _m, e, n in entries}
    stages = [
        {
            "slug": stage["slug"],
            "number": stage["number"],
            # Tier-local position (Stage 1, 2 … within each tier) — what the
            # catalogue displays. `number` stays the global one, used to match a
            # stage to its tier and to name its MIDI directory.
            "tierNumber": local[stage["number"]],
            "title": stage["title"],
            "goal": stage["goal"],
            "modules": [
                {
                    "slug": mod["slug"],
                    "title": mod["title"],
                    "subtitle": mod["subtitle"],
                    "lessons": [
                        {
                            "id": e["slug"],
                            "number": numbers[e["slug"]],
                            "name": e["name"],
                            "tier": e["tier"],
                            "planned": bool(e.get("planned")),
                        }
                        for e in mod["lessons"]
                    ],
                }
                for mod in stage["modules"]
            ],
            "closing": (
                {
                    "id": stage["closing"]["slug"],
                    "number": numbers[stage["closing"]["slug"]],
                    "name": stage["closing"]["name"],
                    "tier": "checkpoint",
                    "planned": False,
                }
                if stage.get("closing")
                else None
            ),
        }
        for stage in CURRICULUM
    ]

    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        f.write(render({"tiers": TIERS, "stages": stages, "lessons": lessons}) + "\n")

    planned = sum(1 for _s, _m, e, _n in entries if e.get("planned"))
    print(f"wrote {len(lessons)} lesson(s) ({planned} planned) to {OUT}")


if __name__ == "__main__":
    main()
