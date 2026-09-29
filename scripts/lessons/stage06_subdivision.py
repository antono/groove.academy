"""Stage 6 — Subdivision & the grid.

Two grids, not one fast one. Everything up to here divided the beat in two and
then in two again; this stage adds the division in three, and then the feel that
lives between them. The voices barely move — kick, snare and one hat, the same
three pads as Stage 2 — because the whole difficulty is meant to be *where the
notes are*, not how many hands are busy.

Nothing here uses the open hat, so a kit with no usable hi-hat pedal can play the
entire stage.
"""

from .bass import OCTAVE, QUARTER, SHUFFLE, SYNCOPATED
from .grids import (
    BACKBEAT,
    DOWNBEATS,
    EIGHTHS,
    SIXTEENTHS,
    SWUNG,
    TRIPLETS,
    alternating,
    cycle_bars,
    voices,
)
from .midi import CLOSED_HH, KICK, SNARE
from .schema import checkpoint, lesson, module, stage

# --- Module 1: sixteenths -----------------------------------------------------


def hats_16ths_split(bars=4):
    """Sixteen closed hats a bar and nothing else, shared between the hands.

    One lane, because it is one hi-hat: which hand plays which note is
    instruction rather than MIDI. Splitting them is the only way this density is
    sustainable at all — a single hand playing sixteen is a Stage 4 problem, and
    putting it here would make the lesson about endurance instead of the grid.
    """
    return voices(bars, (CLOSED_HH, SIXTEENTHS))


def rock_16th_hats(bars=4):
    """The Stage 2 rock beat with the hat line doubled to 16ths.

    Kick and snare do not move by a single note from `rock_beat_8th_hats`, so
    everything that is new is in the hat hand — and every kick and snare still
    lands on a hat, with three hats and nothing else in between.
    """
    return voices(bars, (CLOSED_HH, SIXTEENTHS), (KICK, DOWNBEATS), (SNARE, BACKBEAT))


# The two 16th slots an 8th-note grid cannot reach, one in each half of the bar:
# the "a" of 1 pushes into the snare, the "e" of 3 arrives just after the beat.
KICK_16TH_GRID = [0, 0.75, 2, 2.25]


def kick_16th_grid(bars=4):
    """8th hats, backbeat, and a kick on the "e" and the "a".

    The hat drops back to 8ths deliberately: hand speed was the last lesson's
    problem and placement is this one's. Both of the added kicks fall *between*
    two hat notes, so a kick heard together with a hat is a kick that landed on
    the "and" instead.
    """
    return voices(
        bars, (CLOSED_HH, EIGHTHS), (KICK, KICK_16TH_GRID), (SNARE, BACKBEAT)
    )


# --- Module 2: triplets -------------------------------------------------------


def triplets_8th(bars=4):
    """Twelve 8th-note triplets a bar, strictly hand to hand across two pads.

    Three notes to a beat against two hands does not divide, so the hand that
    starts a beat swaps every beat — snare on 1, hat on 2, snare on 3, hat on 4
    — and the pair only comes round after two beats. That is the lesson as much
    as the grid is: the same reason `trading_three_voices` runs its rotation
    across the bar line rather than resetting it.
    """
    return alternating(bars, SNARE, CLOSED_HH, TRIPLETS)


def triplet_groove(bars=4):
    """Triplet hats over the backbeat — the 12/8 feel, three hats to a beat."""
    return voices(bars, (CLOSED_HH, TRIPLETS), (KICK, DOWNBEATS), (SNARE, BACKBEAT))


def triplets_broken(bars=4):
    """`triplets_8th` with the middle note of every triplet taken out.

    Two things fall out of one deletion, which is why this is the module's
    stretch rather than a second exercise. What is left sounding is the shuffle
    skeleton — the first and last note of each triplet — which is what the next
    module is entirely built on. And the strict alternation collapses into
    pairs: the notes that survive are S S H H S S H H, so the snare hand owns
    beats 1 and 2, the hat hand owns 3 and 4, and each of them plays two in a
    row for the first time in the curriculum.

    Derived from the full triplet rather than written out, so the claim that it
    *is* the same lesson with a hole in it is true by construction.
    """
    kept = [(i, pos) for i, pos in enumerate(TRIPLETS) if i % 3 != 1]
    return voices(
        bars,
        (SNARE, [pos for i, pos in kept if i % 2 == 0]),
        (CLOSED_HH, [pos for i, pos in kept if i % 2 == 1]),
    )


# --- Module 3: feel -----------------------------------------------------------


def shuffle_hats(bars=4):
    """Swung 8ths on one pad: two notes a beat, the second one late."""
    return voices(bars, (CLOSED_HH, SWUNG))


def shuffle_groove(bars=4):
    """The full shuffle: swung hats, kick on 1 and 3, snare on 2 and 4."""
    return voices(bars, (CLOSED_HH, SWUNG), (KICK, DOWNBEATS), (SNARE, BACKBEAT))


# Kick on 1 and on the swung note before beat 3 — the late 8th, so it drives
# into the snare rather than sitting square in front of it.
HALF_TIME_KICK = [0, 1 + 2 / 3]
HALF_TIME_SNARE = [2]  # beat 3, alone: the backbeat at half the rate


def half_time_shuffle(bars=4):
    """The shuffle with one snare a bar, on 3, and the kick on the late 8th.

    The hat line is identical to `shuffle_groove`. Halving the backbeat is what
    halves the feel; the tempo is untouched, which is the thing about half time
    that has to be felt rather than explained. The ghost notes this groove is
    famous for wait for Stage 6 — the app cannot hear how hard a pad was hit
    yet, so a ghost note would be scored as a note like any other.
    """
    return voices(
        bars, (CLOSED_HH, SWUNG), (KICK, HALF_TIME_KICK), (SNARE, HALF_TIME_SNARE)
    )


# --- Checkpoint ---------------------------------------------------------------


def checkpoint_3(bars=4):
    """One bar each: 16ths, triplets, the shuffle, the half-time shuffle.

    The same three pads for all four bars, and the same kick and snare under the
    first three — so the *only* thing changing on each bar line is how the beat
    is divided. That is what makes this the test: a student who has one grid and
    a habit can play any of these bars alone and cannot play them in a row.
    """
    return cycle_bars(
        bars,
        [
            [(CLOSED_HH, SIXTEENTHS), (KICK, DOWNBEATS), (SNARE, BACKBEAT)],
            [(CLOSED_HH, TRIPLETS), (KICK, DOWNBEATS), (SNARE, BACKBEAT)],
            [(CLOSED_HH, SWUNG), (KICK, DOWNBEATS), (SNARE, BACKBEAT)],
            [(CLOSED_HH, SWUNG), (KICK, HALF_TIME_KICK), (SNARE, HALF_TIME_SNARE)],
        ],
    )


STAGE = stage(
    number=6,
    slug="subdivision",
    title="Subdivision & the Grid",
    goal="The 16th grid and the triplet grid, and a note placed anywhere on "
    "either.",
    modules=[
        module(
            "sixteenths",
            "Sixteenths",
            "twice as fine",
            [
                lesson(
                    slug="hats-16ths-split",
                    name="16ths, Split Hands",
                    tier="plain",
                    drums=hats_16ths_split,
                    bass=QUARTER,
                    prereq=["alternating-8ths", "eighths-weak-hand"],
                    summary="Sixteen closed hats a bar, shared between the hands — "
                    "the 16th grid on its own.",
                    description=(
                        "The grid gets twice as fine. Sixteen notes a bar, all of "
                        "them the same pad, and nothing else sounding — so the only "
                        "question the lesson asks is whether they are even. Two "
                        "hands share the line, alternating strictly, which is the "
                        "only way this density is sustainable; one hand playing all "
                        "sixteen is a later problem. You already played this "
                        "alternation in 8ths back in Pulse. It is the same "
                        "movement, twice as often."
                    ),
                    hints=[
                        "Two fingers on the hat pad, one from each hand, strictly "
                        "alternating. Never let one hand take two in a row — that "
                        "is a different lesson.",
                        'Count it out loud: "1 e and a, 2 e and a." Four syllables '
                        "a beat, one note each.",
                        "The beats are what matter. If 1, 2, 3 and 4 land, the "
                        "three notes between them follow; chase all sixteen equally "
                        "and none of them land.",
                        'The "e" and the "a" are the ones that drift, because they '
                        "are the notes with nothing underneath them. Lumpy usually "
                        "means those two are early.",
                        "Evenness beats effort here. If every fourth note is louder "
                        "than the rest, you are playing a quarter-note line with "
                        "decoration on it.",
                    ],
                ),
                lesson(
                    slug="rock-16th-hats",
                    name="Rock Beat, 16th Hats",
                    tier="core",
                    drums=rock_16th_hats,
                    bass=OCTAVE,
                    prereq=["hats-16ths-split", "rock-beat-8th-hats"],
                    summary="The rock beat with the hat line doubled: 16th hats "
                    "over kick on 1 and 3, snare on 2 and 4.",
                    description=(
                        "The groove from Stage 2 with the hat hand running twice as "
                        "fast. Kick and snare have not moved a single note — 1 and "
                        "3, 2 and 4, exactly where they were — so everything new is "
                        "in the hat. Every kick and every snare still lands on a "
                        "hat, and between them sit three hats with nothing else "
                        "under them at all. That gap is where the beat goes missing."
                    ),
                    hints=[
                        "Two weak-hand fingers alternating on the hat; kick and "
                        "snare stay on the strong hand where they have always been.",
                        "Start the hat line alone and let it run a full bar before "
                        "you add anything. It is the constant, and the kick and "
                        "snare drop into it.",
                        "Only every fourth hat has a drum with it. Count "
                        '"1 e and a" and put the kick and snare on the numbers, '
                        "never on a syllable.",
                        'A snare that slides onto the "e" after beat 2 means you '
                        "are following the hats instead of counting the beat.",
                        "If the hats thin out to 8ths underneath the snare, the "
                        "strong hand is stealing the weak one's timing. A bar of "
                        "hats only, then a bar of everything.",
                    ],
                ),
                lesson(
                    slug="kick-16th-grid",
                    name='Kick on the "e" and the "a"',
                    tier="stretch",
                    drums=kick_16th_grid,
                    bass=SYNCOPATED,
                    prereq=["rock-16th-hats"],
                    summary='Kick on the "a" of 1 and the "e" of 3 — the two 16th '
                    "slots an 8th-note grid cannot reach.",
                    description=(
                        "The hat drops back to 8ths, because hand speed was the "
                        "last lesson's problem and placement is this one's. Two of "
                        "the four kicks land in slots nothing has ever landed on "
                        'before: the "a" of beat 1, which pushes forward into the '
                        'snare, and the "e" of beat 3, which arrives just after the '
                        "down-beat. Neither of them has a hat on it — they are the "
                        "first notes in the curriculum that sound completely alone "
                        "between two other notes."
                    ),
                    hints=[
                        "Everything except two kicks is Stage 2. Play Rock Beat, "
                        "8th Hats once, then add them.",
                        'The "a" of 1 belongs to beat 2 and arrives before it. Lean '
                        "it forward into the snare rather than dropping it after "
                        'the "and".',
                        'The "e" of 3 belongs to beat 3 and arrives just after it. '
                        "Kick, then wait — it is a pickup, not a push.",
                        "Both extra kicks fall between two hat notes and never with "
                        "one. If you hear kick and hat together, it went on the "
                        '"and".',
                        "Keep counting 16ths through the whole bar even though your "
                        "hat is only playing 8ths. Those two kicks have no other "
                        "reference.",
                        'The bass pushes on the "and" of 2 and 4, which is a slot '
                        "you are not playing. Let it go past.",
                    ],
                ),
            ],
        ),
        module(
            "triplets",
            "Triplets",
            "three where there were two",
            [
                lesson(
                    slug="triplets-8th",
                    name="8th-Note Triplets",
                    tier="plain",
                    drums=triplets_8th,
                    bass=SHUFFLE,
                    prereq=["alternating-8ths-swap"],
                    summary="Three notes to a beat, hand to hand — the other way to "
                    "divide a beat.",
                    description=(
                        "A new grid, not a faster one. Everything so far has split "
                        "the beat in two and then in two again; this splits it in "
                        "three, and the two grids meet nowhere except on the beat "
                        "itself. The hands alternate strictly, and because three "
                        "notes do not divide between two hands the hand that "
                        "starts a beat swaps every beat. Snare on the lead hand, "
                        "closed hat on the other, so you can hear that swap as well "
                        "as feel it. The bass is playing the same grid with you."
                    ),
                    hints=[
                        'Say it before you play it: "trip-a-let, trip-a-let." Three '
                        "even syllables a beat — not two fast ones and a slow one.",
                        "Snare on the strong hand, hat on the weak one, strictly "
                        "alternating. Neither hand ever takes two in a row.",
                        "Snare starts beat 1, hat starts beat 2, snare starts beat "
                        "3. That is correct and it is the lesson — do not try to "
                        "fix it.",
                        "The middle note is the tell. If it sounds like a 16th "
                        "figure with a note missing, the middle note is sitting too "
                        "close to the first.",
                        "Play only the four beats first, alternating hands, then "
                        "fill in the two between each pair without letting the "
                        "beats move.",
                    ],
                ),
                lesson(
                    slug="triplet-groove",
                    name="Triplet Groove",
                    tier="core",
                    drums=triplet_groove,
                    bass=QUARTER,
                    prereq=["triplets-8th", "rock-beat-8th-hats"],
                    summary="Triplet hats over the backbeat: three hats a beat, "
                    "kick on 1 and 3, snare on 2 and 4.",
                    description=(
                        "The triplet grid underneath a groove you already know. "
                        "Kick and snare stay exactly where they were, and the hat "
                        "runs three to a beat above them, so every kick and every "
                        "snare has a hat on it and two more hats fall into the "
                        "space after it. This is the 12/8 feel behind slow blues "
                        "and half the ballads ever recorded. The bass has stopped "
                        "playing triplets with you and gone back to marking the "
                        "beat — the grid is yours to hold now."
                    ),
                    hints=[
                        "Two weak-hand fingers alternate on the hat pad; the strong "
                        "hand keeps kick and snare where they have always been.",
                        'Say "trip-a-let" on every beat and drop the kick or snare '
                        'on the "trip".',
                        "Every kick and snare lands with the first hat of a "
                        "triplet, never the second or third. Landing on the middle "
                        "one means you are early.",
                        "Two hats fall in the space after each kick and snare. Do "
                        "not let them collapse into one — that is a shuffle, and it "
                        "is two lessons away.",
                        "If the groove starts sounding straight, the third hat of "
                        "each triplet is late and glueing itself onto the next "
                        "beat.",
                    ],
                ),
                lesson(
                    slug="triplets-broken",
                    name="Broken Triplets",
                    tier="stretch",
                    drums=triplets_broken,
                    bass=SYNCOPATED,
                    prereq=["triplet-groove"],
                    summary="The middle note of every triplet taken out — and the "
                    "sticking turns into doubles.",
                    description=(
                        "Take the middle note out of the triplets you played two "
                        "lessons ago and two things happen at once. What is left "
                        "sounding is the shuffle skeleton — the first and last note "
                        "of each triplet — which is what the whole next module is "
                        "built on. And the strict alternation collapses into pairs: "
                        "with the middle note gone, each hand plays two in a row. "
                        "Snare owns beats 1 and 2, hat owns 3 and 4, and the swap "
                        "in the middle of the bar is the hard part. The bass has "
                        "gone straight and is no help at all."
                    ),
                    hints=[
                        'Keep counting all three — "trip-a-let" — and play only '
                        '"trip" and "let". The note you are not playing is what '
                        "holds the two you are in place.",
                        "Snare, snare, then hat, hat. The strong hand takes beats 1 "
                        "and 2, the weak hand takes 3 and 4, and the swap on beat 3 "
                        "is the only difficult moment in the bar.",
                        "Two in a row on one hand is new. Lift the finger between "
                        "them instead of pressing twice from the same place, or the "
                        "second one lands as a flam.",
                        "The second note of each pair is late if you are hearing it "
                        'as an "and" — it sits closer to the next beat than to '
                        "halfway.",
                        'The bass pushes on the "and" of 2 and 4, between your two '
                        "notes and belonging to neither. It is not a note you play.",
                    ],
                ),
            ],
        ),
        module(
            "feel",
            "Feel",
            "straight and swung",
            [
                lesson(
                    slug="shuffle-hats",
                    name="Shuffle Hats",
                    tier="plain",
                    drums=shuffle_hats,
                    bass=SHUFFLE,
                    prereq=["triplets-broken"],
                    summary="Swung 8ths on the hat: two notes a beat, the second "
                    "one deliberately late.",
                    description=(
                        "The same rhythm as the last lesson on one pad and one "
                        "hand, and now it has a name. Two notes a beat: one on the "
                        "beat, one two thirds of the way to the next. That second "
                        "note is what a swung 8th is — an off-beat that arrives "
                        "late on purpose — and placing it consistently late is the "
                        "entire skill. Nothing else sounds, and the bass swings "
                        "with you so you can hear when yours does not."
                    ),
                    hints=[
                        'One hand, one pad, and the pair is uneven: "long, short, '
                        'long, short."',
                        'Say "hump-ty, dump-ty" through the bar. The natural rhythm '
                        "of the words is the feel.",
                        "If it is coming out straight you are splitting the beat in "
                        'two. Go back to "trip-a-let" and play "trip" and "let" '
                        "only.",
                        'The swung note is not halfway and it is not an "and". It '
                        "is twice as far from the beat it left as from the one it "
                        "is heading for.",
                        "The beats themselves have to stay dead even. A shuffle "
                        "where the beat moves is not a shuffle, it is uneven "
                        "playing.",
                        "Listen to the bass's late note. When yours lands with it "
                        "the feel is right; when they come apart, yours has "
                        "straightened.",
                    ],
                ),
                lesson(
                    slug="shuffle-groove",
                    name="The Shuffle",
                    tier="core",
                    drums=shuffle_groove,
                    bass=SHUFFLE,
                    prereq=["shuffle-hats", "rock-beat-8th-hats"],
                    summary="The full shuffle: swung hats over kick on 1 and 3, "
                    "snare on 2 and 4.",
                    description=(
                        "The backbeat underneath the swung hat line. Kick and snare "
                        "are on the numbers exactly as they always were, so the "
                        "only thing carrying the feel is the second hat of each "
                        "pair — and the moment it straightens, the whole groove "
                        "turns back into a rock beat. This is one of the two or "
                        "three grooves that hold up an entire genre on their own."
                    ),
                    hints=[
                        "Hat on the weak hand, kick and snare on the strong. "
                        "Nothing has moved since Stage 2 except the hat's second "
                        "note.",
                        "Every kick and every snare lands with a hat that is on the "
                        "beat. The swung hat is always alone.",
                        "The backbeat is where a shuffle lives. Lean on 2 and 4 and "
                        "let the swung hats sit under them.",
                        'If it flattens into a rock beat the swung hat has crept '
                        'forward onto the "and". Stop, play a bar of hats alone, '
                        "start again.",
                        "The bass is swinging too. If its late note and yours are "
                        "not landing together, one of you is straight, and it is "
                        "not the bass.",
                    ],
                ),
                lesson(
                    slug="half-time-shuffle",
                    name="Half-Time Shuffle",
                    tier="stretch",
                    drums=half_time_shuffle,
                    bass=SYNCOPATED,
                    prereq=["shuffle-groove"],
                    summary="The shuffle with one snare a bar, on 3 — and a "
                    "straight bass underneath that will not help you.",
                    description=(
                        "The backbeat moves. Instead of 2 and 4 there is a single "
                        "snare on beat 3, which halves the feel of the groove "
                        "without changing its tempo at all — the hat line is note "
                        "for note the same as the last lesson. The second kick "
                        "lands on the swung note before beat 3, so it arrives late "
                        "and drives into the snare. And the bass has gone straight: "
                        'it pushes on the "and"s, a slot the shuffle does not have, '
                        "and it is there to be ignored. The ghost notes this groove "
                        "is famous for wait for Stage 6, where the app can hear how "
                        "hard you hit."
                    ),
                    hints=[
                        "The hats have not changed. Play The Shuffle once, then move "
                        "the snare.",
                        "One snare a bar, on beat 3. Beat 4 has nothing but a hat, "
                        "and that empty 4 is where a snare creeps back in out of "
                        "habit.",
                        "The second kick is on the late note before beat 3, so it "
                        'lands with a swung hat. If it feels like an "and", you '
                        "have straightened it.",
                        "The bass is playing straight against you. Your hat is the "
                        "grid, not the bass — lock to it and let the rest go past.",
                        "Half time is a feel, not a speed. Nothing your hands do "
                        "got slower; you are counting the same four beats you "
                        "always were.",
                    ],
                ),
            ],
        ),
    ],
    closing=checkpoint(
        slug="checkpoint-6",
        name="Checkpoint — Subdivision & the Grid",
        drums=checkpoint_3,
        bass=QUARTER,
        summary="One bar each: 16th hats, triplet hats, the shuffle, and the "
        "half-time shuffle.",
        description=(
            "The same three pads for four bars, and the same kick and snare under "
            "three of them. The only thing that changes on each bar line is how "
            "the beat is divided: four 16ths, then three triplets, then the swung "
            "pair, then the shuffle with its backbeat moved to 3. Switching grids "
            "with no warning is much harder than any one of them, and it is what "
            "proves you have both grids rather than one grid and a habit. The "
            "bass plays plain quarter notes — it is the one line that does not "
            "take a side."
        ),
        hints=[
            "The count changes on every bar line and nothing announces it: "
            '"1 e and a", then "trip a let", then the swung pair.',
            "Bar 1 into bar 2 is the hard one. Sixteen hats become twelve and the "
            "beats do not move — let them hold and change only what is between "
            "them.",
            "Bars 3 and 4 are the same hat line. Only the kick and snare move, and "
            "the snare moves to beat 3 alone.",
            "Kick and snare are identical in bars 1, 2 and 3. If they shift when "
            "the hat line changes, the hat hand is dragging the other one with it.",
            "Do not slow down for the shuffle or speed up for the 16ths. One "
            "tempo, four grids.",
        ],
    ),
)
