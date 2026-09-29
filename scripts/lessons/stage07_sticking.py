"""Stage 7 — Sticking.

Rudiments, then rudiments inside a groove: *which* hand plays a note starts to
matter as much as when.

Three modules, and the order is the technique's own. **Strokes** is the alphabet
— singles, then doubles — because every rudiment below is built from those two
and nothing else. **The paradiddle** is the first pattern that mixes them, and
the first where the hands stop taking turns. **Bigger diddles** stretches the
same idea over six strokes instead of four, which is why that module lives on
the triplet grid: a six-stroke cell is one bar of triplets exactly and fits
nothing on the straight one.

Every lesson here is two pads and one note at a time — snare on the lead hand,
closed hat on the other — except where a kick is the explicit subject. The
sticking *is* the exercise, and a third voice only gives the student somewhere
else to put a mistake.
"""

from .bass import DUB, OCTAVE, PEDAL, QUARTER, RIFF, SHUFFLE, SYNCOPATED
from .grids import (
    DOWNBEATS,
    EIGHTHS,
    SIXTEENTHS,
    TRIPLETS,
    alternating,
    cycle_bars,
    sticking,
    voices,
)
from .midi import CLOSED_HH, KICK, SNARE
from .schema import checkpoint, lesson, module, planned, stage


def singles_16ths(bars=4):
    """R L R L, strictly, in 16th notes.

    The alphabet's first letter. Sixteen positions, sixteen hits, the hands
    taking turns with no exception — so there is nothing to remember and
    everything to control. Snare on the lead, closed hat on the other, which
    makes an uneven hand audible rather than merely felt: two pads alternating
    should sound like one instrument, and the moment one hand is louder or late
    you hear it as a limp.

    Sixteen is even, so every bar opens on the lead hand again. That is
    deliberate — the point is evenness, not a hand swap, which Stage 5 already
    covered.
    """
    return alternating(bars, SNARE, CLOSED_HH, SIXTEENTHS)


def doubles_8ths(bars=4):
    """R R L L in 8th notes — the second letter, at half the speed of singles.

    Two per hand, in 8ths, so each double has a whole beat to happen in. The
    exercise is that the second stroke of a pair is as loud and as placed as the
    first; a double that dies away is a bounce rather than two strokes, and it
    is why this sits at 8ths before it sits at 16ths.
    """
    return sticking(bars, SNARE, CLOSED_HH, EIGHTHS, "RRLLRRLL")


def doubles_16ths(bars=4):
    """The same R R L L, now four to a beat.

    Nothing new to learn and everything harder to do: at this spacing the
    second stroke of each pair is where the hand naturally gives up and lets the
    stick bounce. Same pattern, half the time, and the whole lesson is whether
    the second note survives.
    """
    return sticking(bars, SNARE, CLOSED_HH, SIXTEENTHS, "RRLL" * 4)


# The four places a diddle can sit inside a four-stroke cell. Bar 1 is the
# paradiddle already learned, with the diddle at the end; then the front, then
# the middle, and finally across the join, where the pair straddles the two
# halves of the bar instead of sitting inside one. Starting from the familiar
# one matters more than walking the positions in order. Both hands get every
# position, because each eight-note line is its own mirror.
INVERSIONS = [
    "RLRRLRLL",  # diddle third and fourth — the one they know
    "RRLRLLRL",  # diddle first and second
    "RLLRLRRL",  # diddle second and third
    "RLRLLRLR",  # diddle fourth and fifth, across the join
]


def paradiddle_inversions(bars=4):
    """One inversion per bar: the same eight strokes, the diddle walking.

    Every bar has four singles and two doubles, so nothing gets harder in the
    hands. What changes is where the double falls against the beat, and that
    turns out to be the whole difficulty — a paradiddle learned as a shape
    starting on beat 1 does not survive the shape moving.

    Four bars, four positions: the diddle at the end of the cell, then at the
    front, then in the middle, and finally across the join, where it straddles
    the two halves of the bar instead of sitting inside one.
    """
    return cycle_bars(
        bars,
        [
            [
                (SNARE, [p for p, h in zip(EIGHTHS, hands) if h == "R"]),
                (CLOSED_HH, [p for p, h in zip(EIGHTHS, hands) if h == "L"]),
            ]
            for hands in INVERSIONS
        ],
    )


def paradiddle_double(bars=4):
    """R L R L R R / L R L R L L — twelve strokes, one bar of triplets.

    Six strokes per hand-lead instead of four: four singles then the diddle,
    rather than two singles then the diddle. It is the same idea stretched, and
    it fits the triplet grid exactly — twelve notes, one bar — which is why this
    module changes grid rather than cramming a six into a four.

    The count is the giveaway: this is two groups of six, not three groups of
    four, so the bar's four beats cut across the pattern instead of agreeing
    with it.
    """
    return sticking(bars, SNARE, CLOSED_HH, TRIPLETS, "RLRLRR" + "LRLRLL")


def paradiddle_diddle(bars=4):
    """R L R R L L, twice a bar on triplets — and it never swaps hands.

    Every other rudiment here alternates its lead: what the right hand does in
    the first half, the left does in the second. This one does not. Six strokes,
    always starting on the same hand, so the lead hand owns the accent for the
    whole lesson and the pattern becomes an ostinato you could hold under
    something else.

    That is exactly why drummers use it, and exactly what makes it awkward
    first: nothing ever gives the weak hand the lead, so it never gets the easy
    stroke.
    """
    return sticking(bars, SNARE, CLOSED_HH, TRIPLETS, "RLRRLL" * 2)


def six_stroke_roll(bars=4):
    """R L L R R L, twice a bar — two doubles wrapped in two singles.

    The inverse of the paradiddle-diddle's shape: single, double, double,
    single. The two doubles sit in the middle where they are hardest to place,
    with a lone stroke either side marking the edges of the cell.

    Like the paradiddle-diddle this starts on the same hand every time, so the
    six strokes repeat rather than mirror — the second cell in the bar is the
    first one again, not its reflection.
    """
    return sticking(bars, SNARE, CLOSED_HH, TRIPLETS, "RLLRRL" * 2)


def checkpoint_7(bars=4):
    """One bar each: singles, doubles, the paradiddle, the double paradiddle.

    The stage's four shapes with nothing between them, and the last bar changes
    the grid as well as the sticking — sixteen straight notes, then eight, then
    eight, then twelve triplets. Switching sticking is the point; switching feel
    on top of it is what makes this the place the stage is passed rather than a
    medley of things already played.
    """
    def line(positions, hands):
        return [
            (SNARE, [p for p, h in zip(positions, hands) if h == "R"]),
            (CLOSED_HH, [p for p, h in zip(positions, hands) if h == "L"]),
        ]

    return cycle_bars(
        bars,
        [
            line(SIXTEENTHS, "RL" * 8),
            line(EIGHTHS, "RRLLRRLL"),
            line(EIGHTHS, "RLRRLRLL"),
            line(TRIPLETS, "RLRLRR" + "LRLRLL"),
        ],
    )


# One full paradiddle per bar, in 8th notes. Shared by both lessons in this
# module so the groove is provably the same sticking as the plain version — the
# kick is the only thing that changes between them.
PARADIDDLE = "RLRRLRLL"


def paradiddle_single(bars=4):
    """R L R R / L R L L in 8th notes — one full paradiddle per bar.

    The lead hand plays the snare and the other the closed hat, so the two
    doubles (RR and LL) are audible as a repeated pad rather than felt only in
    the fingers. Nothing stacks: every 8th note is exactly one hit from one
    hand, which is the point — the sticking is the whole exercise and a third
    voice would only give the student somewhere else to put the mistake.
    """
    return sticking(bars, SNARE, CLOSED_HH, EIGHTHS, PARADIDDLE)


def paradiddle_groove(bars=4):
    """The same paradiddle, with a kick on 1 and 3 underneath it.

    The hands do not change. Snare on the lead, closed hat on the other, the
    identical R L R R / L R L L — so the one new thing in this lesson is the
    foot, and a paradiddle that falls apart here fell apart because of the
    kick and nothing else. That is the whole step from `plain` to `core`: the
    rudiment stops being an exercise and starts being a groove.

    The kick lands on beats 1 and 3, which is where a groove puts it and also
    the two places it teaches the most. Beat 1 is a lead-hand snare, so the
    strong hand plays both pads at once; beat 3 is an other-hand hat, so the
    kick arrives against the opposite hand. One kick per bar would be a
    decoration — these two are the two different problems.
    """
    lead = [p for p, hand in zip(EIGHTHS, PARADIDDLE) if hand == "R"]
    other = [p for p, hand in zip(EIGHTHS, PARADIDDLE) if hand == "L"]
    return voices(bars, (SNARE, lead), (CLOSED_HH, other), (KICK, DOWNBEATS))


STAGE = stage(
    number=7,
    slug="sticking",
    title="Sticking",
    goal="Rudiments, then rudiments inside a groove. Which hand plays a note "
    "starts to matter as much as when.",
    modules=[
        module(
            "strokes",
            "Strokes",
            "singles and doubles",
            [
                lesson(
                    slug="singles-16ths",
                    name="Single Strokes in 16ths",
                    tier="plain",
                    drums=singles_16ths,
                    bass=QUARTER,
                    prereq=["hats-16ths-split"],
                    summary="The first sticking of all: R L R L in strict 16th "
                    "notes, snare on the lead hand and closed hat on the other.",
                    description=(
                        "Sixteen notes in the bar and the hands simply take turns. "
                        "There is nothing here to memorise, which is the point — "
                        "every rudiment in this stage is built from single strokes "
                        "and doubles, and this is the first of the two. The "
                        "difficulty is entirely in evenness: sixteen hits that "
                        "sound the same and land the same distance apart. Putting "
                        "the snare on one hand and the closed hat on the other is "
                        "what makes that audible rather than merely felt — two pads "
                        "alternating should sound like one instrument. The bass "
                        "walks in plain quarter notes and asks nothing of you."
                    ),
                    hints=[
                        'Count "1 e and a, 2 e and a". Your lead hand has every '
                        'number and every "and"; the other hand has every "e" and '
                        'every "a".',
                        "Two pads alternating should sound like one instrument. If "
                        "you can hear which hand is playing, that hand is hitting "
                        "harder than the other one.",
                        "The usual fault is a limp — the weak hand arriving a "
                        "fraction late, so the stream goes long-short, long-short. "
                        "Listen to the gaps rather than to the hits.",
                        "Every bar opens on the lead hand again, because sixteen is "
                        "an even number and nothing swaps. Starting a bar on the "
                        "wrong hand means you dropped a note or added one.",
                        "If it collapses, play a bar of lead hand alone on the four "
                        "beats and let the other hand drop in between. Add the "
                        "remaining notes once those two are even.",
                    ],
                ),
                lesson(
                    slug="doubles-8ths",
                    name="Double Strokes",
                    tier="core",
                    drums=doubles_8ths,
                    bass=OCTAVE,
                    prereq=["singles-16ths"],
                    summary="R R L L in 8th notes: two strokes per hand, with a "
                    "whole beat for each pair.",
                    description=(
                        "The alphabet's second letter. Where singles alternate on "
                        "every note, this plays twice with one hand before handing "
                        "over — two snares, then two hats, then two snares again. "
                        "In 8th notes each pair has a whole beat to happen in, "
                        "which is deliberate: there is room here to *place* the "
                        "second stroke rather than let it fall. That second stroke "
                        "is the entire lesson. If it comes out quieter than the "
                        "first you are letting the stick bounce, and a bounce is "
                        "not a note you control."
                    ),
                    hints=[
                        "Four pairs a bar, landing on the beats: snare on 1, hat on "
                        "2, snare on 3, hat on 4, each with its double on the "
                        '"and".',
                        "The second stroke of each pair is the lesson. Play it as "
                        "deliberately as the first — same height, same weight — "
                        "rather than letting the finger rebound.",
                        "A pair that arrives as one thick note is the second stroke "
                        "chasing the first. Lift between them and put the second "
                        "one exactly on the \"and\".",
                        "The hand-over is where doubles go wrong: the last note of "
                        "one pair and the first of the next belong to different "
                        "hands and must be the same distance apart as everything "
                        "else.",
                        "The bass bounces on the 8ths here, which doubles your own "
                        "spacing back at you. Use it — if your pairs are uneven you "
                        "will hear them drift against it.",
                    ],
                ),
                lesson(
                    slug="doubles-16ths",
                    name="Double Strokes in 16ths",
                    tier="stretch",
                    drums=doubles_16ths,
                    bass=SYNCOPATED,
                    prereq=["doubles-8ths"],
                    summary="The same R R L L, now four notes to a beat — where a "
                    "double stops being two strokes and starts being a bounce.",
                    description=(
                        "Nothing new to learn and everything harder to do. The "
                        "pattern is the one you just played, at half the spacing, "
                        "and the second stroke of every pair now lands where the "
                        "hand naturally wants to give up and let the stick do the "
                        "work. Two full doubles fit inside each beat, so a pair "
                        "that sags is immediately audible as a stumble rather than "
                        "a dynamic. The bass has stopped helping too: it pushes "
                        "between your notes instead of marking them, and holding "
                        "the pattern against it is part of the exercise."
                    ),
                    hints=[
                        'Two pairs to a beat: "1 e" is your lead hand twice, "and '
                        'a" is the other hand twice. Four beats, eight pairs.',
                        "Play it as four even notes that happen to be two per hand, "
                        "not as two thumps with a decoration after each one.",
                        "If the second stroke of a pair is quieter, the pattern "
                        "turns into a limp with a ghost note — which is a real "
                        "drumming sound, but not this lesson.",
                        "The bass is pushing between your hits on purpose. Do not "
                        "follow it; keep the sixteen notes even and let it argue.",
                        "When the hands tie up, the fault is nearly always the "
                        "hand-over rather than the doubles. Watch the join between "
                        "the two hats and the two snares that follow.",
                    ],
                ),
            ],
        ),
        module(
            "the-paradiddle",
            "The paradiddle",
            "alternate, then double",
            [
                lesson(
                    slug="paradiddle-single",
                    name="Single Paradiddle",
                    tier="plain",
                    drums=paradiddle_single,
                    bass=QUARTER,
                    prereq=["doubles-8ths"],
                    summary="The first sticking pattern: R L R R, L R L L in 8th "
                    "notes, snare on the lead hand and closed hat on the other.",
                    description=(
                        "Until now each hand owned its own pads and its own beats. "
                        "The paradiddle breaks that: the hands alternate — R L — "
                        "then one of them plays twice in a row — R R — and the "
                        "whole thing flips on the second half of the bar. Snare is "
                        "the lead hand, closed hat the other, so you can hear the "
                        "two doubles as well as feel them. Nothing ever stacks — "
                        "one hit, one hand, every 8th note — and the bass walks in "
                        "plain quarter notes, so the sticking is the only hard "
                        "thing here."
                    ),
                    hints=[
                        'Say it before you play it: "pa-ra-did-dle, pa-ra-did-dle" '
                        "— four syllables per half bar, one 8th note each.",
                        "Two fingers, two pads, and the hands never swap roles: "
                        "snare on your strong hand, closed hat on the weak one. No "
                        "two pads ever fire together, so if you hear a stack you "
                        "played an extra note.",
                        'The doubles are the lesson. Beat 2 and "2-and" are two '
                        'snares in a row; beat 4 and "4-and" are two hats. '
                        "Everything else alternates.",
                        'Drill the two halves separately: a bar of nothing but "R L '
                        'R R", then a bar of nothing but "L R L L". Join them only '
                        "once neither one needs counting.",
                        "The second double lands on the last two 8ths of the bar, "
                        "so every bar starts on the opposite hand to the one that "
                        "just played twice: two hats, then straight back to the "
                        "snare on 1.",
                        "A double that arrives as one flam means the second finger "
                        "is chasing the first. Lift it early and drop it on time "
                        "rather than pushing it faster.",
                        "Extra notes usually mean a triple crept in. Stop at the "
                        "bar line and restart the count instead of playing through "
                        "it.",
                    ],
                ),
                lesson(
                    slug="paradiddle-groove",
                    name="Paradiddle Groove",
                    tier="core",
                    drums=paradiddle_groove,
                    bass=RIFF,
                    prereq=["paradiddle-single"],
                    summary="The same paradiddle, with a kick on 1 and 3 "
                    "underneath — the rudiment becomes a groove.",
                    description=(
                        "Everything your hands do here you already did in 2.4: "
                        "the identical R L R R, L R L L, snare on the strong hand "
                        "and closed hat on the weak one. What is new is the kick, "
                        "on beats 1 and 3, and that is enough to turn a rudiment "
                        "into something you could play behind a song. The two "
                        "kicks are deliberately different problems. On beat 1 the "
                        "strong hand is already playing the snare, so both pads "
                        "fire together off one hand. On beat 3 the strong hand is "
                        "free and the weak one is on the hat, so the kick lands "
                        "against the opposite hand instead. If the sticking "
                        "survives both, it will survive a real groove."
                    ),
                    hints=[
                        "Play 2.4 once first. The hands are identical, so anything "
                        "that falls apart here is the kick — you know exactly what "
                        "changed.",
                        "Beat 1 is a stack: kick and snare together, one hand. Drop "
                        "both fingers as a single movement rather than rolling one "
                        "into the other, or it lands as a flam.",
                        "Beat 3 is the easier of the two and the one people rush — "
                        "the strong hand is free, so it tends to arrive early. Let "
                        "the hat on that beat set the timing and put the kick with "
                        "it.",
                        'Keep saying "pa-ra-did-dle" through it. The kick is not '
                        "part of the word, and the moment you start counting the "
                        "kicks instead, the doubles go.",
                        "The doubles are still the lesson: two snares across beat 2 "
                        'and its "and", two hats across beat 4 and its "and". '
                        "Neither of them has a kick on it, so they should be the "
                        "steadiest thing in the bar.",
                        "If a double turns into a single, you are almost certainly "
                        "putting the missing energy into the kick. Play a bar with "
                        "no kick at all, then add it back one beat at a time.",
                    ],
                ),
                lesson(
                    slug="paradiddle-inversions",
                    name="The Four Inversions",
                    tier="stretch",
                    drums=paradiddle_inversions,
                    bass=PEDAL,
                    prereq=["paradiddle-groove"],
                    summary="The same eight strokes every bar, with the diddle one "
                    "step later each time — the paradiddle you know, moved.",
                    description=(
                        "Every bar here has four single strokes and two doubles, so "
                        "nothing gets harder in the hands. What moves is where the "
                        "double falls against the beat. Bar 1 is the paradiddle you "
                        "already have; the three bars after it move the diddle "
                        "to the front of the cell, then into the middle, then "
                        "across the join, where it straddles the two halves of "
                        "the bar instead of sitting inside one. "
                        "This is the lesson that tells you whether you learned a "
                        "rudiment or learned a shape that starts on beat 1. The "
                        "bass holds one root and then scrambles, so there is very "
                        "little underneath you to count against."
                    ),
                    hints=[
                        "Learn the four bars as four separate one-bar patterns "
                        "before you play them in sequence. Joining them is a "
                        "different exercise from playing any one of them.",
                        "Bar 4 is the awkward one: its double lands across the "
                        "middle of the bar rather than inside a half, so the "
                        "familiar four-plus-four shape disappears.",
                        "Say the sticking out loud rather than counting the beats. "
                        "The beats stay where they were; only the hands move.",
                        "Each bar is its own mirror — whatever the lead hand does "
                        "in the first half, the other hand does in the second. If "
                        "the second half is not the reverse of the first, you have "
                        "slipped into the previous bar's pattern.",
                        "Losing the thread mid-bar is normal here. Stop at the bar "
                        "line and start the next one clean rather than trying to "
                        "repair the one you are in.",
                    ],
                ),
            ],
        ),
        module(
            "bigger-diddles",
            "Bigger diddles",
            "longer patterns, same idea",
            [
                lesson(
                    slug="paradiddle-double",
                    name="Double Paradiddle",
                    tier="plain",
                    drums=paradiddle_double,
                    bass=SHUFFLE,
                    prereq=["paradiddle-single"],
                    summary="R L R L R R, L R L R L L — six strokes a side, on "
                    "triplets, one whole pattern per bar.",
                    description=(
                        "The paradiddle stretched: four alternating strokes before "
                        "the double instead of two. Six strokes a side, twelve in "
                        "all, which is exactly one bar of triplets — and that is "
                        "why this module changes grid rather than trying to force "
                        "a six into a four. Count it in threes and the pattern "
                        "fights you; count it in sixes and the bar's four beats cut "
                        "across it, which is the sound you are after. The bass "
                        "swings with you here, marking the same triplets, so the "
                        "grid itself is not the thing you have to hold on to."
                    ),
                    hints=[
                        'The word is "pa-ra-pa-ra-did-dle" — six syllables, one '
                        "triplet note each, twice a bar.",
                        "Two groups of six against four beats: each group starts "
                        "on a beat — 1 and 3 — but beats 2 and 4 land in the "
                        "middle of a group, on its fourth stroke.",
                        "The four singles at the front are where this comes apart, "
                        "not the double at the end. Play them as evenly as the "
                        "16th singles you already have.",
                        "The lead hand starts the bar and the other hand starts the "
                        "second half, exactly like the single paradiddle. If both "
                        "halves start on the same hand you have dropped a stroke.",
                        "The backing swings in triplets with you. If your pattern "
                        "starts drifting against it, the fault is almost always the "
                        "diddle arriving early.",
                    ],
                ),
                lesson(
                    slug="paradiddle-diddle",
                    name="Paradiddle-diddle",
                    tier="core",
                    drums=paradiddle_diddle,
                    bass=QUARTER,
                    prereq=["paradiddle-double"],
                    summary="R L R R L L, twice a bar — the rudiment that never "
                    "swaps hands, so the lead keeps the accent throughout.",
                    description=(
                        "Two singles and then two doubles, six strokes, and here is "
                        "what makes it different from everything else in this "
                        "stage: it does not mirror. Every other rudiment hands the "
                        "lead to the other hand halfway through. This one starts on "
                        "the same hand every single time, so the strong hand owns "
                        "the first note of every cell and the weak hand never gets "
                        "the easy stroke. That is precisely why drummers use it — a "
                        "pattern that always starts on the same hand can be held "
                        "under something else — and precisely why it feels lopsided "
                        "for the first few bars. The bass has gone back to plain "
                        "quarter notes and takes no side about how the beat divides."
                    ),
                    hints=[
                        "Six notes, twice a bar, and the second time is the same as "
                        "the first — not its reflection. If your second cell starts "
                        "on the other hand, you are playing a double paradiddle.",
                        'Say "pa-ra-did-dle-did-dle": two singles then two doubles, '
                        "and it always begins on the strong hand.",
                        "The two doubles run into each other — snare snare, hat hat "
                        "— with no single between them. That join is the hardest "
                        "moment in the pattern.",
                        "Because the lead never changes, the weak hand only ever "
                        "plays doubles here. Expect it to tire before the lead hand "
                        "does, and let that tell you which hand needs the work.",
                        "Both cells start on a beat — 1 and 3 — so the pattern "
                        "fits the bar exactly. What never lines up is the accent: "
                        "the lead hand opens every cell, so it never falls on 2 "
                        "or 4.",
                    ],
                ),
                lesson(
                    slug="six-stroke-roll",
                    name="Six Stroke Roll",
                    tier="stretch",
                    drums=six_stroke_roll,
                    bass=DUB,
                    prereq=["paradiddle-diddle"],
                    summary="R L L R R L: two doubles in the middle with a single "
                    "either side — the stage's hardest placement.",
                    description=(
                        "The paradiddle-diddle turned inside out. Instead of the "
                        "singles leading and the doubles trailing, a lone stroke "
                        "opens the cell, two doubles sit in the middle, and a lone "
                        "stroke closes it. The doubles are now in the worst place "
                        "they can be — surrounded, with nothing on either side to "
                        "lean on — and the two single strokes are what mark the "
                        "edges of a pattern that is otherwise a blur. Like the "
                        "paradiddle-diddle it repeats rather than mirrors. The bass "
                        "never plays the down-beat at all, so nothing underneath "
                        "you agrees with the bar line: this is the end of the stage "
                        "and the point at which the backing stops helping."
                    ),
                    hints=[
                        "Single, double, double, single — snare, two hats, two "
                        "snares, hat. The two lone strokes are the edges; find them "
                        "first and let the doubles fill the middle.",
                        "Both doubles are back to back in the centre of the cell. "
                        "That is where it falls apart, and slowing the doubles down "
                        "relative to the singles is the usual way it does.",
                        "It starts on the same hand every time, like the "
                        "paradiddle-diddle. Two cells a bar, the second identical "
                        "to the first.",
                        "The bass avoids the down-beat completely, so there is no "
                        "landmark on beat 1 but your own playing. Keep the cell "
                        "going and let the bar line take care of itself.",
                        "If the two doubles smear into a single roll, you have "
                        "stopped playing four notes and started playing a buzz. "
                        "Lift between every pair.",
                    ],
                ),
            ],
        ),
    ],
    closing=checkpoint(
        slug="checkpoint-7",
        name="Checkpoint — Sticking",
        drums=checkpoint_7,
        bass=QUARTER,
        summary="One bar each: 16th singles, 8th doubles, the paradiddle, and "
        "the double paradiddle on triplets.",
        description=(
            "Two pads, four bars, and a different sticking on every bar line — "
            "and the last one changes the grid as well. Sixteen straight "
            "singles, then eight notes of doubles, then the paradiddle, then "
            "twelve triplets of the double paradiddle. Any one of these you "
            "have already played. Switching between them with nothing "
            "announcing the change is the thing this stage was for, because a "
            "rudiment you can only start from silence is a rudiment you do not "
            "have yet. The bass plays plain quarter notes: it marks the beats "
            "and says nothing about how they divide, which is the only useful "
            "thing it can do when the division changes under it."
        ),
        hints=[
            "Nothing warns you that the bar is about to change. The beats stay "
            "exactly where they are — only what happens between them moves.",
            "Bar 3 into bar 4 is the hard one: eight straight notes become "
            "twelve triplets. Hold the four beats and change only the count "
            "inside them.",
            "Take the bar lines as four separate starts rather than one "
            "continuous phrase. Landing the first note of each bar on the right "
            "hand is most of the battle.",
            "Every bar begins on the lead hand. If a bar opens on the other "
            "one, the bar before it lost or gained a stroke.",
            "Drill the joins rather than the bars: the last two notes of one "
            "bar and the first two of the next, over and over, and then play "
            "the whole thing.",
        ],
    ),
)
