<script lang="ts">
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onDestroy, onMount, tick } from 'svelte';
	import { metronomeClick } from '$lib/metronome';
	import { parseMidi, loopMidi, LOOP_COUNTS, COUNT_IN_BEATS, type ParsedMidi, type BackingTrack, type MidiNote } from '$lib/midi';
	import { DrumPlayer, drumUrl, warmUrls } from '$lib/drums';
	import { Sampler, sampleUrl } from '$lib/sampler';
	import { activeInstrument } from '$lib/active-instrument.svelte';
	import { Controller, type ControllerSummary,
		type Gesture
	} from '$lib/controller.svelte';
	import {
		VIRTUAL_INPUTS,
		VIRTUAL_KEYBOARD_ID,
		VIRTUAL_TOUCH_ID,
		isVirtualId,
		loadVirtualController,
		keyboardGm,
		TRANSPORT_START_CODE,
		TRANSPORT_STOP_CODE
	} from '$lib/virtual-input';
	import VirtualPads from '$lib/virtual-pads.svelte';
	import { dayKey, recordSession } from '$lib/stats';
	import { queueReconcile } from '$lib/sync';
	import { lessonFinished, lessonStarted } from '$lib/analytics';
	import PageMeta from '$lib/page-meta.svelte';
	import LessonChart from '$lib/lesson-chart.svelte';
	import ControllerPreview from '$lib/controller-preview.svelte';
	import QuoteOfTheDay from '$lib/quote-of-the-day.svelte';
	import { isQuotesOff } from '$lib/quote-store';
	import { laneColor } from '$lib/drum-colors';

	// `id` is the lesson's slug and never changes; `number` ("2.4") is rendered
	// from its position in the curriculum, so inserting a lesson renumbers the
	// catalogue without orphaning practice history or a remembered tempo.
	type Lesson = {
		id: string;
		number: string;
		name: string;
		file: string;
		bpm: number;
		bars: number;
		/** Most scored hits landing together; absent in a manifest generated
		    before the field existed, in which case nothing is said. */
		voices?: number;
		description?: string;
		hints?: string[];
	};
	type Status = 'pending' | 'perfect' | 'good' | 'off' | 'miss';

	// Pixels per beat on the highway — display only (scoring reads the audio clock,
	// never pixels). On a narrow screen it shrinks so more beats fit before the hit
	// line: the notes arrive from further off and slower, giving room to prepare
	// instead of appearing a beat away. See the reactive `PX_PER_BEAT` below.
	const PX_PER_BEAT_WIDE = 110;
	// 78, not 110: on a 320px phone the hit line leaves roughly 270px of lookahead,
	// which at the wide spacing is about two and a half beats — a note appears and
	// is on you. At 78 it is three and a half, most of a bar, which is the
	// difference between reading the pattern and reacting to it. Eighths still sit
	// 39px apart against a 26px note block, so nothing collides.
	const PX_PER_BEAT_NARROW = 78;
	const LANE_H = 56; // resting lane height; grows to fill the viewport while playing
	const BEATS_PER_BAR = 4;
	// One bar of lead-in before the pattern. It is no longer empty: the lesson MIDI
	// carries a "count-in" track whose clicks live in exactly this bar, so the
	// constant is shared with the parser that shifts them onto the beat axis.
	const COUNT_IN = COUNT_IN_BEATS;
	const MATCH_WINDOW_BEATS = 0.4; // how far a hit may be from a target to count at all
	// How far ahead a pad lights its "play me next" border as its note nears the hit
	// line — enough warning to move a finger, not so much that half the pads glow.
	const CUE_LOOKAHEAD_BEATS = 1;
	// Beginner-friendly timing grades (|error| in ms):
	const PERFECT_MS = 25; // exact  -> green, pops
	const GOOD_MS = 60; // precise -> green
	// between GOOD_MS and the match window -> off (orange); past the window -> miss (red)
	const STORAGE_PREFIX = 'groove-master:';

	// The audio/scoring clock runs on a coarse setInterval instead of per-frame rAF,
	// so the main thread never wakes every vsync and the compositor scroll stays
	// uncoupled from main-thread scheduling (see startScroll / schedule).
	const SCHED_INTERVAL_MS = 25; // how often the scheduler runs
	const SCHED_LOOKAHEAD_SEC = 0.1; // schedule backing audio this far ahead of the clock

	let audioCtx: AudioContext | null = $state(null);
	let player: DrumPlayer | null = null;
	let backingPlayer: Sampler | null = null;

	// Backing tracks (bass, etc.) — auto-played, never shown or scored. Which
	// instrument plays is whatever the lesson MIDI names in its track ("bass:lately").
	let backing: BackingTrack[] = $state([]);
	let backingCursors: number[] = []; // per-track note pointer, advanced by the scheduler

	// Count-in clicks, all at negative beats (beat 0 is the student's). Played on
	// their own kit through the drum player, never shown and never scored.
	let countIn: MidiNote[] = $state([]);
	let countInCursor = 0;

	// The hi-hat a hatless lesson borrows to keep time against. Rides the same
	// clock and the same lookahead as everything else, plays on the lesson's own
	// kit, and — like the count-in — is never shown and never scored. Its MIDI
	// velocity is what keeps it under the student's playing.
	let guide: MidiNote[] = $state([]);
	let guideCursor = 0;

	// MIDI, plus the student's instrument. Everything the page used to keep about
	// the device by hand — a note map, a transport binding, a grid size, the drum
	// each pad triggers, the saved name, the kit — is the Controller's now, and it
	// is loaded once per device rather than reassembled here.
	let midiAccess: MIDIAccess | null = $state(null);
	let midiInputs: { id: string; name: string | null }[] = $state([]);
	// The keyboard and on-screen pads are always-present sources, so a lesson is
	// playable with no MIDI hardware and on a touchscreen that has no Web MIDI at
	// all. They sit after any real port, so a connected device is preferred.
	// A configured instrument whose port has not been enumerated yet still belongs
	// in this list: MIDI access is only requested on the first Play, so before that
	// the active hardware instrument would be missing and the chooser would show a
	// blank selection for an instrument that is in fact loaded and playable.
	const inputs = $derived.by<{ id: string; name: string | null }[]>(() => {
		const list = [...midiInputs, ...VIRTUAL_INPUTS];
		for (const s of activeInstrument.all) {
			if (!list.some((i) => i.id === s.deviceId)) list.unshift({ id: s.deviceId, name: s.name });
		}
		return list;
	});
	let selectedId: string | null = $state(null);
	let currentInput: MIDIInput | null = null;
	let controller = $state<Controller | null>(null);
	/** configured controllers on this machine, so the chooser can name them */
	let known = $state(new Map<string, ControllerSummary>());

	const kit = $derived(controller?.kitId ?? 1);

	let lessons: Lesson[] = $state([]);
	let selected: Lesson | null = $state(null);
	// Ids the student has earned. The first lesson is always open; each next one
	// opens once its predecessor is finished at NEXT_LESSON_BPM or faster.
	let unlockedLessons = $state(new Set<string>());
	// One pass of the lesson as written, which the chart draws, and the run built
	// from it — the same pass tiled `loops` times, which everything else plays.
	let single: ParsedMidi | null = $state(null);
	let parsed: ParsedMidi | null = $state(null);
	// Back-to-back passes per run, chosen on the resting page and remembered per
	// lesson. Like tempo it is fixed for the length of a run.
	let loops = $state(1);
	// A click on every beat, remembered per lesson. Unlike tempo and loops it can
	// be flipped mid-run: it only adds sound, and changes nothing that is scored.
	let metronome = $state(false);
	let metroBeat = 0; // next whole beat the run's metronome will click
	let demoMetroBeat = 0; // the same for a Listen preview
	let lanes: number[] = $state([]);
	let drumNames = $state(new Map<number, string>());

	// Tempo is a plain choice from a menu: every step of TEMPO_STEP across the
	// supported range, plus the lesson's own tempo wherever that falls between them.
	const TEMPO_MIN = 40;
	const TEMPO_MAX = 240;
	const TEMPO_STEP = 10;
	const NEXT_LESSON_BPM = 80; // finishing at or above this opens the next lesson

	let baseBpm = $state(60); // the lesson's own tempo, what the menu starts on
	let selectedBpm = $state(60);

	// The tempo everything (scroll, scheduler, scoring) runs at.
	const bpm = $derived(selectedBpm);

	const tempoOptions = $derived.by(() => {
		const opts = new Set<number>([baseBpm, selectedBpm]);
		for (let v = TEMPO_MIN; v <= TEMPO_MAX; v += TEMPO_STEP) opts.add(v);
		return [...opts].sort((a, z) => a - z);
	});

	// The lesson that follows this one in the curriculum order, and whether it has
	// been earned yet — the "Next lesson →" button appears only once it is unlocked.
	const nextLesson = $derived.by(() => {
		if (!selected) return null;
		const i = lessons.findIndex((l) => l.id === selected!.id);
		return i >= 0 && i + 1 < lessons.length ? lessons[i + 1] : null;
	});
	const nextUnlocked = $derived(!!nextLesson && unlockedLessons.has(nextLesson.id));

	// Between lessons: the result screen's "Next lesson" shows a Quote of the Day
	// first (unless opted out), then advances on rate/close. The resting-page nav
	// link is unchanged — the quote is only for finishing a scored run.
	let quoteOpen = $state(false);

	function toNextLesson() {
		if (!nextLesson) return;
		if (isQuotesOff()) goto(`${base}/lessons/${nextLesson.id}`);
		else quoteOpen = true;
	}

	function advanceToNext() {
		quoteOpen = false;
		if (nextLesson) goto(`${base}/lessons/${nextLesson.id}`);
	}

	// A locked Next lesson still shows — a curriculum you cannot see the shape of is
	// not a curriculum — so it has to say what would open it, and how close you are.
	const nextLessonHint = $derived(
		`Finish this lesson at ${NEXT_LESSON_BPM} BPM or faster to unlock it.`
	);

	// The lesson before this one. Unlike the next one it carries no condition: going
	// back is revision, and a student who is here has already been there.
	const prevLesson = $derived.by(() => {
		if (!selected) return null;
		const i = lessons.findIndex((l) => l.id === selected!.id);
		return i > 0 ? lessons[i - 1] : null;
	});

	let playing = $state(false);
	let paused = $state(false); // transport frozen mid-lesson; highway stays up
	let status = $state('');
	let beatPos = -COUNT_IN;
	let startBeat = -COUNT_IN; // beat the current scroll segment started from

	// Per-target scoring state (parallel to parsed.notes).
	let matched: boolean[] = $state([]);
	let statuses: Status[] = $state([]);
	let deltas: (number | null)[] = $state([]); // signed ms, - = early
	let extras: { note: number; beat: number }[] = [];
	let report: Report | null = $state(null);

	// Note indices sorted by beat, plus a single advancing cursor, so the miss
	// scan touches only newly-passed notes instead of the whole array each frame.
	let missOrder: number[] = [];
	let missCursor = 0;

	let flashing: Set<number> = $state(new Set());
	let flashTimers = new Map<number, ReturnType<typeof setTimeout>>();

	let startAudioTime = 0; // audioCtx.currentTime at the start of the current scroll segment
	let schedTimer: ReturnType<typeof setInterval> | 0 = 0;
	let dpr = 1; // cached devicePixelRatio; refreshed on resize
	let stripEl: HTMLDivElement | null = $state(null);

	const laneName = (n: number) => drumNames.get(n) ?? String(n);
	const laneRow = (n: number) => lanes.indexOf(n);
	// Everything the drum player needs decoded before a run: the lesson's own pads
	// plus the count-in click and the guide hat, neither of which is a lane and so
	// neither of which ever appears in `lanes`.
	// Everything that might need a sample warm before a run: the lesson's own lanes,
	// the count-in and guide — and every drum the *active controller* can produce.
	// A virtual controller (and any kit) has pads the lesson never uses, and hitting
	// one cold triggers a fetch+decode mid-run, which lands late and reads as jitter.
	// Preloading the controller's full drum set keeps every pad instant.
	const kitNotes = $derived([
		...lanes,
		...countIn.map((n) => n.note),
		...guide.map((n) => n.note),
		...(controller?.drums ?? [])
	]);
	const hasMapping = $derived((controller?.pads.length ?? 0) > 0);
	// Nothing to draw for a student who has never run the setup wizard.
	const hasPadLayout = $derived(!!controller && controller.pads.some((p) => p.note != null));
	// A virtual source draws its own pad grid (VirtualPads: named, coloured, keyed),
	// so the generic ControllerPreview schematic — blank for it but for the one lane
	// the lesson uses — is redundant and suppressed.
	const isVirtual = $derived(isVirtualId(selectedId));

	// Which hi-hat voices this lesson actually asks for. If it is exactly one, the
	// lesson is not teaching pedal technique — it is teaching the pattern — so the
	// hat is pinned to that voice and every way of striking it counts. Only a
	// lesson using both voices leaves the pedal in charge.
	//
	// Without this, a kit whose pedal is at rest resolves every hat to *open*,
	// which is correct for a drummer and useless here: a closed-hat lesson scores
	// nothing while the preview still lights, so the hits look like they landed.
	$effect(() => {
		const c = controller;
		if (!c) return;
		const hats = [c.hihat.closed, c.hihat.open].filter((n) => lanes.includes(n));
		c.hihatPreference = hats.length === 1 ? hats[0] : null;
	});

	// Drums this lesson calls for that the instrument cannot produce. Said here,
	// before the run, rather than left to surface as misses nobody can explain.
	const unplayable = $derived(controller && lanes.length ? controller.missing(lanes) : []);

	/**
	 * How many hits this lesson lands together, where that is more than the
	 * student can reach. Zero when it is within reach, when no instrument is
	 * configured, or when the manifest predates the field — in every one of
	 * those the honest answer is to say nothing.
	 */
	const beyondReach = $derived.by(() => {
		const needs = selected?.voices ?? 0;
		return controller && needs && !controller.canStrike(needs) ? needs : 0;
	});
	/** A stick kit with no bass pedal is one pedal away from the third voice. */
	const aPedalWouldDo = $derived(
		controller?.struck === 'sticks' && !controller.pads.some((p) => p.pedal === 'kick')
	);

	// A "session" spans from play until the result screen is dismissed. The highway
	// stays fullscreen for the whole span — including while the report is shown — so
	// finishing a lesson never collapses the layout (that reflow scored a 0.52 CLS).
	const inSession = $derived(playing || !!report);

	const NOTE = 26; // note block size (px)
	let winH = $state(0); // viewport height, for the full view; refreshed on resize
	let winW = $state(0); // viewport width, to widen the highway's perspective on a phone
	const PX_PER_BEAT = $derived(winW > 0 && winW <= 640 ? PX_PER_BEAT_NARROW : PX_PER_BEAT_WIDE);

	// GM notes whose targets are approaching the hit line right now — the pads that
	// should light a "get ready" border, refreshed each frame while the run plays.
	let cueSounds = $state<Set<number>>(new Set());

	// Three ways to run a lesson, cycled from the HUD and remembered across lessons:
	//  - compact (default): rows two note-heights apart — a thin strip centred in a
	//    static field of its own colour, only the notes scrolling.
	//  - medium: the same banded strip, twice as tall (four note-heights a row).
	//  - full: lanes balloon to fill the viewport, the original stretched grid.
	// compact and medium are "banded" — centred, edged top and bottom; full is not.
	const VIEWS = ['compact', 'medium', 'full'] as const;
	type View = (typeof VIEWS)[number];
	let view = $state<View>('compact');
	const laneH = $derived(
		inSession && lanes.length
			? view === 'full'
				? Math.max(48, Math.floor(winH / lanes.length))
				: view === 'medium'
					? 4 * NOTE
					: 2 * NOTE
			: LANE_H
	);
	const viewLabel = $derived(view[0].toUpperCase() + view.slice(1));

	// The preview during a run takes whatever the highway left, and is dropped when
	// that is nothing. While playing the highway is a fixed full-viewport field
	// with the lanes as a band centred in it, so the room is the empty half below
	// that band — not space in the flow, of which there is none.
	//
	// `laneH` above knows nothing about any of this, which is the point: the
	// highway is sized first and the reference can never squeeze the lesson. In
	// the full view, defined as filling the viewport, there is never room at all.
	const runRoom = $derived(Math.max(0, (winH - lanes.length * laneH) / 2) - 28);
	const runPreview = $derived(
		view === 'full'
			? null
			: runRoom >= 360
				? 'lg'
				: runRoom >= 260
					? 'md'
					: runRoom >= 180
						? 'sm'
						: null
	);

	// ---- boot / loading -------------------------------------------------

	// The brief and the pattern chart need no audio, so they load on mount and the
	// page is readable before the user opts into sound.
	async function loadCatalogue() {
		try {
			const [lRes, dRes] = await Promise.all([
				fetch(`${base}/lessons/manifest.json`),
				fetch(`${base}/drums/manifest.json`)
			]);
			lessons = (await lRes.json()).lessons ?? [];
			const drums = (await dRes.json()).drums ?? [];
			drumNames = new Map(drums.map((d: { note: number; name: string }) => [d.note, d.name]));
		} catch {
			status = 'Could not load manifests — run make-lessons.py & render-drums.py';
		}
	}

	// Follow the route: this component is reused across /lessons/[id], so navigating
	// to the next lesson never remounts it. Selecting off `page.params.id` here — not
	// once in loadCatalogue — means the "Next lesson" link actually loads the lesson
	// rather than leaving the old one on screen until a full reload.
	$effect(() => {
		const id = page.params.id;
		if (!lessons.length || selected?.id === id) return;
		const wanted = lessons.find((l) => l.id === id);
		if (wanted) void selectLesson(wanted);
		else status = `No lesson "${id}" in the manifest`;
	});

	// Audio needs a user gesture, so the samplers and MIDI come up on the first
	// click of Play or Listen. MIDI is deliberately NOT awaited: requestMIDIAccess
	// stays pending until the user answers the browser's permission prompt, and
	// nothing about starting the transport should wait on that. Pads simply come
	// alive whenever access lands.
	async function enableAudio() {
		if (audioCtx) return;
		audioCtx = new AudioContext();
		player = new DrumPlayer(audioCtx);
		backingPlayer = new Sampler(audioCtx);
		void initMidi();
		await player.preload(kit, kitNotes);
		for (const t of backing) backingPlayer.preload(t.family, t.id, t.notes.map((n) => n.note));
	}

	async function initMidi() {
		// No Web MIDI at all (or it's blocked) is no longer a dead end: the keyboard
		// and on-screen pads are always available, so there's nothing to warn about.
		if (!navigator.requestMIDIAccess) return;
		try {
			midiAccess = await navigator.requestMIDIAccess({ sysex: false });
			refreshInputs();
			midiAccess.onstatechange = refreshInputs;
			known = new Map(Controller.list().map((c) => [c.deviceId, c]));
			const saved = activeInstrument.id;
			// A real port that just appeared takes precedence over whatever was
			// resolved before MIDI was granted, but only if nothing is chosen yet.
			if (saved && inputs.some((i) => i.id === saved)) selectedId = saved;
			else if (!selectedId && midiInputs.length) selectedId = midiInputs[0].id;
		} catch {
			status = 'MIDI access denied — keyboard and on-screen pads still play';
		}
	}

	function refreshInputs() {
		if (!midiAccess) return;
		midiInputs = [...midiAccess.inputs.values()].map((i) => ({ id: i.id, name: i.name }));
		// This page holds MIDI access, so it is the one surface that can say which
		// ports are really there. The header chip reports presence only from this.
		//
		// An empty list is published as "unknown", not as "nothing is plugged in":
		// enumeration can report nothing for a moment after access is granted, and
		// saying "not connected" about a controller that is sitting right there is
		// worse than saying nothing.
		activeInstrument.setPorts(midiInputs.length ? midiInputs.map((i) => i.id) : null);
	}

	function loadDeviceMapping(deviceId: string) {
		controller = isVirtualId(deviceId)
			? loadVirtualController(deviceId)
			: Controller.load(deviceId);
	}

	$effect(() => {
		const id = selectedId;
		if (!id) return;
		// A source change detaches the previous MIDI port; a virtual source has none
		// to wire — its capture (keyboard listener, on-screen pads) reads selectedId.
		if (currentInput) {
			currentInput.onmidimessage = null;
			currentInput = null;
		}
		if (!isVirtualId(id) && midiAccess) {
			currentInput = midiAccess.inputs.get(id) ?? null;
			if (currentInput) currentInput.onmidimessage = handleMidi;
		}
		loadDeviceMapping(id);
		// The store owns the selection; this effect owns the port. Writing the key
		// here too is what made a fresh visit look configured on its second load.
		activeInstrument.set(id);
	});

	// The "play me next" cue: while a run is live, each frame collects the notes whose
	// targets are within a beat of the hit line and lights their pads. currentBeat()
	// is read off the audio clock (not reactive), so the rAF loop drives it; the state
	// is only reassigned when the set actually changes, to keep the pads from churning.
	$effect(() => {
		// Only the on-screen pads show the cue, so only a touch run pays for the loop —
		// a keyboard or MIDI run has no overlay to light and does no per-frame work.
		if (!playing || paused || !parsed || selectedId !== VIRTUAL_TOUCH_ID) {
			cueSounds = new Set();
			return;
		}
		const notes = parsed.notes;
		let raf = 0;
		// Tracked locally, NOT by reading cueSounds — reading the state we write would
		// make this effect its own dependency and restart the loop every frame.
		let prevKey = '';
		const loop = () => {
			const b = currentBeat();
			const next: number[] = [];
			for (const n of notes) {
				const d = n.beat - b;
				if (d > -MATCH_WINDOW_BEATS && d <= CUE_LOOKAHEAD_BEATS && !next.includes(n.note))
					next.push(n.note);
			}
			const key = next.sort((a, z) => a - z).join(',');
			if (key !== prevKey) {
				prevKey = key;
				cueSounds = new Set(next);
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	async function selectLesson(lesson: Lesson) {
		stop();
		selected = lesson;
		// The remembered tempo wins; otherwise the lesson's own.
		baseBpm = lesson.bpm;
		selectedBpm = readSelected(lesson.id) ?? baseBpm;
		report = null;
		status = 'Loading ' + lesson.name + '…';
		try {
			const res = await fetch(`${base}/lessons/${lesson.file}`);
			single = parseMidi(await res.arrayBuffer());
		} catch {
			status = 'Could not load lesson MIDI';
			return;
		}
		loops = readLoops(lesson.id);
		metronome = readFlag(metronomeKey(lesson.id));
		buildRun();
		lanes = [...new Set(single.notes.map((n) => n.note))].sort((a, b) => b - a);
		countIn = single.countIn;
		countInCursor = 0;
		beatPos = -COUNT_IN;
		status = '';
		player?.preload(kit, kitNotes);
		for (const t of backing) backingPlayer?.preload(t.family, t.id, t.notes.map((n) => n.note));
		warmLessonSamples();
	}

	// Fetch everything this lesson will play — its kit drums and its backing
	// samples — into the service-worker cache while the resting page sits idle, so
	// the first Listen or Play is a decode of local bytes rather than a download.
	// Fetch-only (no AudioContext), so it needs no gesture and can run on visit.
	// The awaited preload on Play/Listen still guarantees correctness; this only
	// removes the wait. Runs at low priority and is a no-op once samples are cached.
	//
	// It must never run *during* a lesson. `requestIdleCallback` carries a 3 s
	// timeout, so it fires whether or not the page ever went idle — start a run
	// inside that window and a few dozen fetches burst through the service worker
	// while the highway is scrolling. Nothing is lost by cancelling: `play()`
	// awaits a full preload of exactly these URLs before the first beat, so a run
	// warms them itself.
	let cancelWarm: () => void = () => {};

	function warmLessonSamples() {
		cancelWarm(); // a lesson switch supersedes the previous lesson's warm-up
		const urls = [
			...kitNotes.map((n) => drumUrl(kit, n)),
			...backing.flatMap((t) => t.notes.map((n) => sampleUrl(t.family, t.id, n.note)))
		];
		const run = () => {
			cancelWarm = () => {};
			if (playing || demoing) return; // never compete with a run or a preview
			void warmUrls(urls);
		};
		if (typeof requestIdleCallback === 'function') {
			const id = requestIdleCallback(run, { timeout: 3000 });
			cancelWarm = () => cancelIdleCallback(id);
		} else {
			const id = setTimeout(run, 500);
			cancelWarm = () => clearTimeout(id);
		}
	}

	// (Re)tile the lesson into the run `loops` asks for. Only ever called at rest.
	function buildRun() {
		if (!single) return;
		parsed = loopMidi(single, loops);
		backing = parsed.backing;
		backingCursors = backing.map(() => 0);
		guide = parsed.guide;
		guideCursor = 0;
		resetScoring();
	}

	function selectLoops(value: number) {
		stopDemo(); // a preview must not switch length under its own playhead
		loops = value;
		buildRun();
		if (!selected) return;
		try {
			localStorage.setItem(loopsKey(selected.id), String(value));
		} catch {
			// Storage full or blocked — the choice just will not be remembered.
		}
	}

	const metronomeKey = (lessonId: string) => STORAGE_PREFIX + 'metronome:' + lessonId;

	function readFlag(key: string): boolean {
		try {
			return localStorage.getItem(key) === '1';
		} catch {
			return false;
		}
	}

	function toggleMetronome() {
		metronome = !metronome;
		if (!selected) return;
		try {
			localStorage.setItem(metronomeKey(selected.id), metronome ? '1' : '0');
		} catch {
			// Storage full or blocked — the choice just will not be remembered.
		}
	}

	// Click every whole beat from `*cursor` up to the lookahead horizon, stopping at
	// the end of the run. The cursor advances whether or not the metronome is on, so
	// switching it on mid-run picks up at the next beat instead of catching up.
	function scheduleMetronome(cursor: number, horizon: number, at: (beat: number) => number) {
		if (!parsed || !audioCtx) return cursor;
		while (cursor < parsed.lengthBeats && cursor <= horizon) {
			if (metronome)
				metronomeClick(
					audioCtx,
					Math.max(at(cursor), audioCtx.currentTime),
					cursor % BEATS_PER_BAR === 0
				);
			cursor++;
		}
		return cursor;
	}

	const loopsKey = (lessonId: string) => STORAGE_PREFIX + 'loops:' + lessonId;

	function readLoops(lessonId: string): number {
		try {
			const n = Number(localStorage.getItem(loopsKey(lessonId)));
			return (LOOP_COUNTS as readonly number[]).includes(n) ? n : 1;
		} catch {
			return 1;
		}
	}

	function bars() {
		if (!parsed) return [];
		const count = parsed.lengthBeats / BEATS_PER_BAR + 1;
		return Array.from({ length: count }, (_, i) => i * BEATS_PER_BAR);
	}

	// ---- scoring --------------------------------------------------------

	function resetScoring() {
		const n = parsed?.notes.length ?? 0;
		matched = Array(n).fill(false);
		statuses = Array(n).fill('pending');
		deltas = Array(n).fill(null);
		extras = [];
		const notes = parsed?.notes ?? [];
		missOrder = notes.map((_, i) => i).sort((a, b) => notes[a].beat - notes[b].beat);
		missCursor = 0;
	}

	function registerHit(gmNote: number, hitBeat: number) {
		if (!parsed) return;
		let best = -1;
		let bestDist = MATCH_WINDOW_BEATS;
		parsed.notes.forEach((t, i) => {
			if (matched[i] || t.note !== gmNote) return;
			const dist = Math.abs(t.beat - hitBeat);
			if (dist < bestDist) {
				bestDist = dist;
				best = i;
			}
		});
		if (best === -1) {
			extras.push({ note: gmNote, beat: hitBeat });
			return;
		}
		const deltaMs = (hitBeat - parsed.notes[best].beat) * (60000 / bpm);
		const abs = Math.abs(deltaMs);
		matched[best] = true;
		deltas[best] = deltaMs;
		statuses[best] = abs <= PERFECT_MS ? 'perfect' : abs <= GOOD_MS ? 'good' : 'off';
	}

	// The controller's own Play / Stop buttons, when the wizard captured them.
	// Start also doubles as resume, so a single mapped button can drive a whole
	// run without touching the screen. Stop pauses first and only ends the run on
	// a second press, matching how hardware transports behave.
	/**
	 * A corner gesture means whatever the moment calls for. The controller
	 * reports one whenever it is performed and knows nothing about lessons;
	 * deciding it is unwanted right now is this page's job.
	 *
	 * **Ignored outright during a run.** A run is the one moment where a stray
	 * chord costs something real — a good take thrown away — so it is the one
	 * moment the gesture does not exist. That rule is what lets the recognition
	 * window be generous, and what made binding gestures per-kit unnecessary.
	 *
	 * Restarting from the result screen is `play()`, not `restart()`: the latter
	 * is a mid-run control and returns early when nothing is playing. `play()`
	 * rewinds first, so it clears the report and starts the lesson over.
	 */
	function handleGesture(g: Gesture) {
		if (playing) return;
		// Either gesture leaves the quote, and neither is an opinion about it: no
		// rating is recorded. It stays marked as seen, because it was shown.
		if (quoteOpen) return advanceToNext();
		if (report) {
			if (g === 'again') void play();
			else toNextLesson();
			return;
		}
		// At rest there is nothing to advance to, so only `again` means anything.
		if (g === 'again') void play();
	}

	function handleTransport(which: 'start' | 'stop') {
		if (which === 'start') {
			if (!playing) void play();
			else if (paused) togglePause();
			return;
		}
		if (!playing) return;
		if (!paused) togglePause();
		else stop();
	}

	// The one place a resolved drum hit turns into sound, light and a score,
	// whatever produced it — a MIDI pad, a keyboard key or an on-screen tap all
	// arrive here already carrying an unambiguous GM note. Everything a source
	// shares lives here so no source can drift: the hidden-tab guard, the sample,
	// the flash and the scoring window are decided once.
	function dispatchHit(gm: number) {
		// A hidden tab is deaf: ignore every hit so nothing sounds or scores while
		// the page is in the background (see handleVisibility).
		if (typeof document !== 'undefined' && document.hidden) return;
		player?.play(kit, gm); // the ONLY sound source — the user's own playing
		flash(gm);
		// Sample the beat straight from the audio clock at the moment of the hit, so
		// timing accuracy doesn't depend on the coarse scheduler cadence.
		//
		// Hits are scored from one match window BEFORE beat 0, not from beat 0 itself:
		// the first target sits on the down-beat, so its early half-window reaches back
		// into the count-in. Cutting the scan off at 0 made an entry a hair early — the
		// normal way a player anticipates a count-in — vanish entirely, and the
		// down-beat then reddened as a miss it was never given the chance to match.
		// Anything earlier than that is still ignored, so warming up on the clicks
		// costs nothing.
		if (playing && !paused) {
			const hitBeat = currentBeat();
			if (hitBeat >= -MATCH_WINDOW_BEATS) registerHit(gm, hitBeat);
		}
	}

	// A hit from a virtual source (keyboard key or on-screen tap). Unlike a MIDI
	// port — which only comes up inside ensureAudio, so the player already exists by
	// the time a message arrives — the keyboard listener and the pads are live on the
	// resting page before any Play/Listen gesture. That tap IS the gesture, so it has
	// to bring audio up itself; without this the first taps are silent (no player yet)
	// and only start sounding once the student happens to press Play.
	function virtualHit(gm: number) {
		// enableAudio() creates the AudioContext and player synchronously, before its
		// first await, so by the next line the player exists and the tapped sample
		// loads on demand — the first hit sounds without waiting on the full preload.
		if (!audioCtx) void enableAudio();
		dispatchHit(gm);
	}

	function handleMidi(event: MIDIMessageEvent) {
		// A hidden tab is deaf, transport included: ignore every message while the
		// page is in the background (see handleVisibility). dispatchHit guards the
		// hit itself for the sources that don't pass through here.
		if (typeof document !== 'undefined' && document.hidden) return;
		if (!event.data || !controller) return;

		// One call, and the page reacts to meaning rather than to bytes. Note
		// mapping, hi-hat pedal state and transport matching all happen in there;
		// by the time a hit arrives its GM note is already unambiguous.
		const ev = controller.handle(event.data);
		if (ev.kind === 'transport') return handleTransport(ev.which);
		// Pedals and unmapped notes fall out here: they never sound and never score.
		if (ev.kind !== 'hit') return;
		// The drum sounds first: a gesture is additional, never a mute.
		dispatchHit(ev.note);
		if (ev.gesture) handleGesture(ev.gesture);
	}

	// The keyboard source. Active only while it's the selected input; a held key is
	// one hit (not a roll), the reserved transport keys drive Start/Stop the way a
	// hardware transport button would, and any other key resolves through the
	// physical-position layout to a GM note or is ignored.
	function handleKeydown(e: KeyboardEvent) {
		if (selectedId !== VIRTUAL_KEYBOARD_ID) return;
		// Don't turn typing into drum hits — there are no fields on this page today,
		// but a future dialog or input shouldn't be swallowed.
		const el = e.target as HTMLElement | null;
		if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
			return;
		if (e.repeat) return; // a held key yields exactly one hit
		if (e.code === TRANSPORT_START_CODE) {
			e.preventDefault();
			handleTransport('start');
			return;
		}
		if (e.code === TRANSPORT_STOP_CODE) {
			e.preventDefault();
			handleTransport('stop');
			return;
		}
		const gm = keyboardGm(controller, e.code);
		if (gm == null) return; // unmapped key — no sound, no score
		e.preventDefault();
		virtualHit(gm);
	}

	function flash(note: number) {
		flashing = new Set([...flashing, note]);
		clearTimeout(flashTimers.get(note));
		flashTimers.set(
			note,
			setTimeout(() => {
				flashing = new Set([...flashing].filter((n) => n !== note));
			}, 90)
		);
	}

	// ---- transport ------------------------------------------------------

	const beatToX = (beat: number) => -beat * PX_PER_BEAT;

	// Positions the strip for a static (paused) frame, snapped to device pixels for
	// crisp notes. While playing the strip is NOT driven from here — a single CSS
	// transform transition animates it on the compositor (see startScroll), immune
	// to main-thread jank. This only runs at rest / on lesson load.
	function updateStrip() {
		if (!stripEl) return;
		const x = Math.round(beatToX(beatPos) * dpr) / dpr;
		stripEl.style.transform = `translate3d(${x}px, 0, 0)`;
	}

	// The transport beat sampled live from the audio clock. Advances continuously
	// between scheduler ticks, so callers (hit scoring) get an exact position.
	function currentBeat() {
		if (!audioCtx) return beatPos;
		return startBeat + (audioCtx.currentTime - startAudioTime) * (bpm / 60);
	}

	// Absolute AudioContext time at which a given beat falls, for lookahead scheduling.
	const beatToAudioTime = (beat: number) => startAudioTime + (beat - startBeat) * (60 / bpm);

	// Hand the whole scroll to the compositor: one linear transform transition from
	// `fromBeat` to the end of the pattern. The scheduler below stays only as the
	// scoring/audio clock and never touches the transform.
	function startScroll(fromBeat: number) {
		if (!stripEl || !parsed) return;
		const durationSec = ((parsed.lengthBeats - fromBeat) * 60) / bpm;
		stripEl.style.transition = 'none';
		stripEl.style.transform = `translate3d(${beatToX(fromBeat)}px, 0, 0)`;
		void stripEl.offsetWidth; // force reflow so the transition starts from here
		stripEl.style.transition = `transform ${durationSec}s linear`;
		stripEl.style.transform = `translate3d(${beatToX(parsed.lengthBeats)}px, 0, 0)`;
	}

	// Freeze the compositor animation at wherever it currently is, then hand
	// positioning back to updateStrip (used when stopping mid-play).
	function freezeScroll() {
		if (!stripEl) return;
		const current = getComputedStyle(stripEl).transform;
		stripEl.style.transition = 'none';
		if (current && current !== 'none') stripEl.style.transform = current;
	}

	// The scoring/audio clock. Runs every SCHED_INTERVAL_MS off the render path — it
	// never requests an animation frame, so the compositor scroll is uncoupled from
	// main-thread scheduling. It only (a) marks passed notes as missed and (b) queues
	// upcoming backing notes at sample-accurate times via the Web Audio clock.
	function schedule() {
		if (!playing || paused || !parsed || !audioCtx) return;
		const ctx = audioCtx; // narrow for use inside the closure below
		beatPos = currentBeat();

		// Any target that has scrolled past the window unhit is a miss. Walk a single
		// beat-sorted cursor so only newly-passed notes touch reactive state. A coarse
		// cadence here is imperceptible — a note reddens a few ms late at most.
		while (
			missCursor < missOrder.length &&
			parsed.notes[missOrder[missCursor]].beat < beatPos - MATCH_WINDOW_BEATS
		) {
			const idx = missOrder[missCursor++];
			if (!matched[idx]) {
				matched[idx] = true;
				statuses[idx] = 'miss';
			}
		}

		// Queue backing (bass) notes up to the lookahead horizon, each scheduled at its
		// exact audio time so bass timing is sample-accurate and frame-rate independent.
		const horizon = beatPos + (SCHED_LOOKAHEAD_SEC * bpm) / 60;

		// The count-in rides the same clock and the same lookahead, so the three
		// clicks sit exactly one beat apart ahead of the student's first hit.
		while (countInCursor < countIn.length && countIn[countInCursor].beat <= horizon) {
			const click = countIn[countInCursor++];
			player?.playAt(kit, click.note, Math.max(beatToAudioTime(click.beat), ctx.currentTime));
		}

		// The borrowed hat, on the same lookahead. It starts at beat 0, so the
		// count-in still leads in alone and the hat arrives with the pattern.
		while (guideCursor < guide.length && guide[guideCursor].beat <= horizon) {
			const g = guide[guideCursor++];
			player?.playAt(
				kit,
				g.note,
				Math.max(beatToAudioTime(g.beat), ctx.currentTime),
				(g.vel ?? 100) / 100
			);
		}

		metroBeat = scheduleMetronome(metroBeat, horizon, beatToAudioTime);

		backing.forEach((track, ti) => {
			let c = backingCursors[ti];
			while (c < track.notes.length && track.notes[c].beat <= horizon) {
				const when = Math.max(beatToAudioTime(track.notes[c].beat), ctx.currentTime);
				const bn = track.notes[c];
				backingPlayer?.playAt(track.family, track.id, bn.note, when, (bn.vel ?? 100) / 100);
				c++;
			}
			backingCursors[ti] = c;
		});

		if (beatPos >= parsed.lengthBeats) finish();
	}

	function startScheduler() {
		stopScheduler();
		schedule(); // fire once immediately so nothing waits a full interval
		schedTimer = setInterval(schedule, SCHED_INTERVAL_MS);
	}

	function stopScheduler() {
		if (schedTimer) {
			clearInterval(schedTimer);
			schedTimer = 0;
		}
	}

	$effect(() => {
		if (parsed) updateStrip(); // position the strip whenever a lesson (re)renders
	});

	// Tempo is chosen before a run, never during one: the scroll, the scheduler and
	// the scoring window all derive from `bpm`, so moving it mid-flight would shift
	// the segment the compositor is already animating. The menu lives on the
	// resting page only, and stopping Listen keeps a preview from being split
	// across two tempos.
	function selectTempo(value: number) {
		stopDemo();
		selectedBpm = value;
		writeSelected(value);
	}

	// Finishing a run at NEXT_LESSON_BPM or faster opens the next lesson.
	function maybeUnlock() {
		if (nextLesson && selectedBpm >= NEXT_LESSON_BPM) unlockLesson(nextLesson.id);
	}

	// ---- remembered choices (localStorage) --------------------------------
	//
	// localStorage, not the stats database: these are read synchronously while the
	// page builds itself, and IndexedDB would hand them back a frame or two later.

	// The tempo last chosen for a lesson. Kept under its old `tier:` name, which
	// progress sync already carries between devices.
	const selectedKey = (lessonId: string) => STORAGE_PREFIX + 'tier:' + lessonId;
	const LESSONS_KEY = STORAGE_PREFIX + 'lessons-unlocked';

	function readSelected(lessonId: string): number | null {
		try {
			const raw = localStorage.getItem(selectedKey(lessonId));
			if (raw == null) return null;
			const n = Math.round(Number(raw));
			return Number.isFinite(n) && n >= TEMPO_MIN && n <= TEMPO_MAX ? n : null;
		} catch {
			return null; // no storage (private mode) — the lesson's tempo still works
		}
	}

	function writeSelected(value: number) {
		if (!selected) return;
		try {
			localStorage.setItem(selectedKey(selected.id), String(value));
		} catch {
			// Storage full or blocked — the chosen tempo just will not be remembered.
		}
	}

	function readUnlockedLessons(): Set<string> {
		try {
			const raw = localStorage.getItem(LESSONS_KEY);
			const ids = raw ? JSON.parse(raw) : [];
			return new Set(Array.isArray(ids) ? ids.filter((i) => typeof i === 'string') : []);
		} catch {
			return new Set();
		}
	}

	function unlockLesson(lessonId: string) {
		if (unlockedLessons.has(lessonId)) return;
		unlockedLessons = new Set([...unlockedLessons, lessonId]);
		try {
			localStorage.setItem(LESSONS_KEY, JSON.stringify([...unlockedLessons]));
		} catch {
			// Storage full or blocked — the unlock just will not persist.
		}
	}

	async function play() {
		if (!parsed || playing) return;
		// Before the awaits below, not after: `playing` only goes true once they
		// resolve, so the idle warm-up's 3 s timeout could otherwise still fire
		// into the preload — or into the first bars — and burst fetches at the
		// service worker while the highway scrolls.
		cancelWarm();
		await enableAudio(); // no-op once audio is already up
		stopDemo(); // the in-place preview and the real run never overlap
		await audioCtx?.resume();
		// Bass must be decoded before the run starts: playAt only fires cached
		// buffers, so on a fresh device an un-awaited backing preload means the
		// scheduler drops every bass note whose fetch+decode hasn't landed yet.
		await Promise.all([
			player?.preload(kit, kitNotes),
			...backing.map((t) => backingPlayer?.preload(t.family, t.id, t.notes.map((n) => n.note)))
		]);
		rewind();
		playing = true;
		// Tell the rest of the app a run is open, so the header cannot swap the
		// instrument out from under the scoring.
		activeInstrument.setRunInProgress(true);
		if (selected) lessonStarted(selected.id);
		// The highway only exists during a session, so let it mount before the
		// scroll and the clock start from it.
		await tick();
		launchClock();
	}

	// Wind a run back to its count-in: the score, every scheduler cursor and the
	// transport all return to where play() found them. Shared with restart() so a
	// second attempt cannot start from a different state than a first one.
	function rewind() {
		resetScoring();
		backingCursors = backing.map(() => 0);
		countInCursor = 0;
		guideCursor = 0;
		metroBeat = 0;
		report = null;
		beatPos = -COUNT_IN;
		startBeat = -COUNT_IN;
		paused = false;
	}

	// Start the clock and the scroll from `startBeat`. Split out of play() because
	// the highway must already be mounted when this runs.
	function launchClock() {
		startAudioTime = audioCtx?.currentTime ?? 0;
		startScroll(startBeat);
		startScheduler();
	}

	// Throw away the run in progress and play the lesson again from the count-in,
	// without leaving the highway. Nothing is filed: a session only reaches the
	// practice history from finish(), so an abandoned attempt scores nothing and
	// leaves no record. Audio is already up and the samples already decoded, so
	// unlike play() this needs no awaits — the count-in starts on the click.
	function restart() {
		if (!playing) return;
		stopScheduler();
		rewind();
		launchClock();
	}

	// Freeze the transport mid-lesson; resume restarts the compositor scroll
	// from the current beat with the remaining duration.
	function togglePause() {
		if (!playing) return;
		if (!paused) {
			paused = true;
			beatPos = currentBeat(); // freeze the clock where it currently is
			stopScheduler();
			freezeScroll();
			updateStrip();
		} else {
			paused = false;
			startBeat = beatPos;
			startAudioTime = audioCtx?.currentTime ?? 0;
			startScroll(startBeat);
			startScheduler();
		}
	}

	// Step compact -> medium -> full -> compact and remember it. Only the vertical
	// layout changes — the horizontal scroll lives on the strip transform and is
	// untouched — so this is safe to cycle mid-run.
	function cycleView() {
		view = VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length];
		if (browser) localStorage.setItem(STORAGE_PREFIX + 'highwayView', view);
	}

	function stop() {
		playing = false;
		paused = false;
		activeInstrument.setRunInProgress(false);
		stopScheduler();
		startAudioTime = 0;
		freezeScroll();
		updateStrip();
	}

	// Page Visibility: a backgrounded tab must be silent and deaf. Hiding freezes a
	// running lesson — it only ever resumes on a manual Play/Resume, never on its
	// own — stops any Listen preview, and suspends the audio graph so nothing plays.
	// Coming back just re-arms the graph; the transport stays wherever the user left it.
	function handleVisibility() {
		if (document.hidden) {
			stopDemo();
			if (playing && !paused) togglePause();
			void audioCtx?.suspend();
		} else {
			void audioCtx?.resume();
		}
	}

	function finish() {
		stop();
		if (parsed) {
			parsed.notes.forEach((_, i) => {
				if (!matched[i]) {
					matched[i] = true;
					statuses[i] = 'miss';
				}
			});
		}
		// Build once and keep the plain object: `report` is $state, so reading it
		// back yields a proxy, and structuredClone (what IndexedDB writes through)
		// throws on those.
		const built = buildReport();
		report = built;
		if (selected) lessonFinished(selected.id);
		maybeUnlock();
		void logSession(built);
		beatPos = parsed ? parsed.lengthBeats : 0;
		updateStrip();
	}

	// File the finished run in the practice history behind /stats. Fire-and-forget
	// and non-throwing by contract (see $lib/stats): the result screen is already
	// on screen and must not wait on, or be broken by, a storage failure.
	async function logSession(r: Report) {
		if (!selected) return;
		const at = Date.now();
		await recordSession({
			at,
			day: dayKey(at),
			lesson: selected.id,
			lessonName: selected.name,
			bpm,
			device: inputs.find((i) => i.id === selectedId)?.name ?? controller?.name ?? null,
			deviceId: selectedId,
			total: r.total,
			hits: r.hits,
			perfect: r.perfect,
			good: r.good,
			off: r.off,
			miss: r.miss,
			extra: r.extra,
			accuracy: r.accuracy,
			avgAbsMs: r.avgAbsMs,
			early: r.early,
			late: r.late,
			durationMs: ((parsed?.lengthBeats ?? 0) + COUNT_IN) * (60000 / bpm),
			grade: r.grade,
			lanes: r.lanes.map((l) => ({
				note: l.note,
				name: l.name,
				total: l.total,
				hits: l.hits,
				avgMs: l.avgMs
			}))
		});
		// Nudge a background sync so this run and any freshly-earned progress reach
		// the cloud promptly. No-op when signed out or offline; queued either way.
		queueReconcile();
	}

	// ---- listen (in-place preview) --------------------------------------
	//
	// Deliberately separate from the transport above: Listen is a preview of the
	// chart the student is looking at, so it must not take over the page. It plays
	// the drum track and the backing straight off the audio clock, walks a playhead
	// across the chart, and never touches scoring or the highway.

	let demoing = $state(false);
	let demoBeat: number | null = $state(null); // playhead position, null when idle
	let demoStart = 0; // audio time of the preview's beat 0
	let demoTimer: ReturnType<typeof setInterval> | 0 = 0;
	let demoRaf = 0;
	let demoDrumCursor = 0;
	let demoGuideCursor = 0;
	let demoBackCursors: number[] = [];

	const demoBeatTime = (beat: number) => demoStart + beat * (60 / bpm);

	async function toggleListen() {
		if (demoing) {
			stopDemo();
			return;
		}
		cancelWarm(); // as in play(): the preview owns the page until it stops
		await enableAudio();
		if (!parsed || !audioCtx) return;
		await audioCtx.resume();
		// Same as Play: await the bass so the preview isn't silent on a fresh device.
		await Promise.all([
			player?.preload(kit, kitNotes),
			...backing.map((t) => backingPlayer?.preload(t.family, t.id, t.notes.map((n) => n.note)))
		]);
		demoDrumCursor = 0;
		demoGuideCursor = 0;
		demoMetroBeat = 0;
		demoBackCursors = backing.map(() => 0);
		// Listen skips the count-in and starts on beat 0 straight away: nobody is
		// playing along, so a bar of clicks would just be a wait before the preview.
		// Counting in belongs to Play, where it lines the student up.
		demoStart = audioCtx.currentTime + 0.25; // brief lead-in so nothing clips
		demoing = true;
		demoSchedule();
		demoTimer = setInterval(demoSchedule, SCHED_INTERVAL_MS);
		trackPlayhead();
	}

	function demoSchedule() {
		if (!demoing || !parsed || !audioCtx) return;
		const ctx = audioCtx;
		const beat = (ctx.currentTime - demoStart) * (bpm / 60);
		const horizon = beat + (SCHED_LOOKAHEAD_SEC * bpm) / 60;

		while (demoDrumCursor < parsed.notes.length && parsed.notes[demoDrumCursor].beat <= horizon) {
			const n = parsed.notes[demoDrumCursor++];
			const when = Math.max(demoBeatTime(n.beat), ctx.currentTime);
			player?.playAt(kit, n.note, when);
			setTimeout(() => flash(n.note), Math.max(0, (when - ctx.currentTime) * 1000));
		}

		// The preview is what the lesson sounds like, so the borrowed hat belongs
		// in it — without it the groove previews differently from how it plays. It
		// flashes nothing: there is no lane of its own to light up.
		while (demoGuideCursor < guide.length && guide[demoGuideCursor].beat <= horizon) {
			const g = guide[demoGuideCursor++];
			player?.playAt(
				kit,
				g.note,
				Math.max(demoBeatTime(g.beat), ctx.currentTime),
				(g.vel ?? 100) / 100
			);
		}

		demoMetroBeat = scheduleMetronome(demoMetroBeat, horizon, demoBeatTime);

		backing.forEach((track, ti) => {
			let c = demoBackCursors[ti];
			while (c < track.notes.length && track.notes[c].beat <= horizon) {
				const when = Math.max(demoBeatTime(track.notes[c].beat), ctx.currentTime);
				const bn = track.notes[c];
				backingPlayer?.playAt(track.family, track.id, bn.note, when, (bn.vel ?? 100) / 100);
				c++;
			}
			demoBackCursors[ti] = c;
		});

		if (beat >= parsed.lengthBeats) stopDemo();
	}

	// The playhead is a single SVG line, so a plain rAF is cheap here — unlike the
	// highway, nothing else is animating while the preview runs.
	function trackPlayhead() {
		cancelAnimationFrame(demoRaf);
		const step = () => {
			if (!demoing || !audioCtx || !parsed) return;
			const b = Math.max(0, Math.min(parsed.lengthBeats, (audioCtx.currentTime - demoStart) * (bpm / 60)));
			// The chart shows one pass, so a looped preview's playhead wraps back to its
			// start at every seam — except on the last pass, which runs on to the
			// closing hit the chart ends on.
			const lastPass = (loops - 1) * parsed.loopBeats;
			demoBeat = b >= lastPass ? b - lastPass : b % parsed.loopBeats;
			demoRaf = requestAnimationFrame(step);
		};
		demoRaf = requestAnimationFrame(step);
	}

	function stopDemo() {
		if (!demoing && !demoTimer) return;
		demoing = false;
		demoBeat = null;
		if (demoTimer) {
			clearInterval(demoTimer);
			demoTimer = 0;
		}
		cancelAnimationFrame(demoRaf);
		demoRaf = 0;
	}

	// Dismiss the result screen, ending the session and collapsing the highway back
	// to its inline size. This runs on a user click, so its layout shift is excluded.
	function exitReport() {
		report = null;
		beatPos = -COUNT_IN;
		updateStrip();
	}

	// ---- report ---------------------------------------------------------

	type LaneReport = { note: number; name: string; total: number; hits: number; avgMs: number };
	type Report = {
		total: number;
		hits: number;
		perfect: number;
		good: number;
		off: number;
		miss: number;
		extra: number;
		accuracy: number;
		avgAbsMs: number;
		early: number;
		late: number;
		grade: string;
		gradeLabel: string;
		lanes: LaneReport[];
	};

	// Encouraging letter grade for beginners, weighted toward tight timing.
	function gradeFor(score: number): { grade: string; gradeLabel: string } {
		if (score >= 0.9) return { grade: 'S', gradeLabel: 'Flawless!' };
		if (score >= 0.75) return { grade: 'A', gradeLabel: 'Great timing' };
		if (score >= 0.6) return { grade: 'B', gradeLabel: 'Solid — nice groove' };
		if (score >= 0.4) return { grade: 'C', gradeLabel: 'Getting there' };
		if (score >= 0.2) return { grade: 'D', gradeLabel: 'Keep practicing' };
		return { grade: 'E', gradeLabel: 'Warm up and try again' };
	}

	function buildReport(): Report {
		const notes = parsed?.notes ?? [];
		const total = notes.length;
		let perfect = 0,
			good = 0,
			off = 0,
			miss = 0,
			absSum = 0,
			hitDeltas = 0,
			early = 0,
			late = 0;
		for (let i = 0; i < total; i++) {
			if (statuses[i] === 'perfect') perfect++;
			else if (statuses[i] === 'good') good++;
			else if (statuses[i] === 'off') off++;
			else if (statuses[i] === 'miss') miss++;
			const d = deltas[i];
			if (d != null) {
				absSum += Math.abs(d);
				hitDeltas++;
				if (d < 0) early++;
				else late++;
			}
		}
		const hits = perfect + good + off;
		const score = total ? (perfect + good * 0.85 + off * 0.5) / total : 0;
		const { grade, gradeLabel } = gradeFor(score);
		const laneReports: LaneReport[] = lanes.map((note) => {
			let t = 0,
				h = 0,
				a = 0,
				c = 0;
			notes.forEach((n, i) => {
				if (n.note !== note) return;
				t++;
				if (deltas[i] != null) {
					h++;
					a += Math.abs(deltas[i] as number);
					c++;
				}
			});
			return { note, name: laneName(note), total: t, hits: h, avgMs: c ? a / c : 0 };
		});
		return {
			total,
			hits,
			perfect,
			good,
			off,
			miss,
			extra: extras.length,
			accuracy: total ? hits / total : 0,
			avgAbsMs: hitDeltas ? absSum / hitDeltas : 0,
			early,
			late,
			grade,
			gradeLabel,
			lanes: laneReports
		};
	}

	onMount(() => {
		const measure = () => {
			winH = window.innerHeight;
			winW = window.innerWidth;
			dpr = window.devicePixelRatio || 1;
		};
		measure();
		// The highway size is a display preference, not a per-lesson one, so it is
		// remembered globally (unlike the per-lesson tempo).
		const savedView = localStorage.getItem(STORAGE_PREFIX + 'highwayView');
		if (savedView && (VIEWS as readonly string[]).includes(savedView)) view = savedView as View;
		unlockedLessons = readUnlockedLessons();
		// Choose an input up front, before (and whether or not) MIDI is granted, so
		// the schematic and a playable source are on the resting page from the start.
		// The saved choice wins; otherwise a touchscreen defaults to the on-screen
		// pads and everything else to the keyboard. Selecting it loads its mapping
		// through the port effect; connecting a real device can still take over there.
		selectedId = activeInstrument.id;
		window.addEventListener('resize', measure);
		window.addEventListener('keydown', handleKeydown);
		document.addEventListener('visibilitychange', handleVisibility);
		void loadCatalogue();

		// The gate. With nothing configured at all, opening a lesson sends the
		// student to the question rather than silently picking an input for them —
		// and remembers where they were going, so finishing a flow brings them back.
		//
		// A synchronous decision over stored state only: `known` is filled from
		// inside initMidi, which is fired on the first Play and never at all without
		// Web MIDI, so consulting it here would gate a configured student on iOS.
		//
		// Last, and without an early return: the lesson still loads and still tears
		// down. Returning early here skipped loadCatalogue, so anything that stopped
		// the navigation left a page with no content on it at all.
		if (!activeInstrument.anyConfigured) {
			const back = page.url.pathname + page.url.search;
			void goto(`${base}/onboarding?next=${encodeURIComponent(back)}`, { replaceState: true });
		}
		return () => {
			window.removeEventListener('resize', measure);
			window.removeEventListener('keydown', handleKeydown);
			document.removeEventListener('visibilitychange', handleVisibility);
		};
	});

	onDestroy(() => {
		if (!browser) return;
		stopDemo();
		stop();
		// This page was the one holding MIDI access; with it gone, presence is
		// unknown again rather than stale. The chip falls back to "configured".
		activeInstrument.setPorts(null);
		audioCtx?.close();
	});
</script>

<!-- The manifest is fetched in onMount, so a crawler — which never runs the
     script — only ever sees the fallbacks. Naming the lesson in a shared link
     would mean loading the manifest in a +page.ts instead. -->
<PageMeta
	title="Groove Academy — {selected?.name ?? 'Lesson'}"
	description={selected?.description ??
		'A looping groove that scrolls toward the hit line. Play it on a MIDI kit or the on-screen pads.'}
/>

<a class="back" href="{base}/lessons">← All lessons</a>
<h1>
	{#if selected}<span class="number">{selected.number}</span>{/if}{selected?.name ?? 'Lesson'}
</h1>

{#if selected?.description && !inSession}
	<p class="description">{selected.description}</p>
{/if}

{#if parsed && !inSession}
	<div class="chart-frame" class:with-pads={hasPadLayout}>
		{#if hasPadLayout && controller}
			{#if isVirtual}
				<!-- A virtual source shows its pads here, beside the chart, exactly where a
				     drum controller's schematic sits — coloured, named, the lesson's pads
				     lit, and tappable to audition. -->
				<VirtualPads
					{controller}
					compact
					lit={flashing}
					onhit={virtualHit}
					keys={selectedId === VIRTUAL_KEYBOARD_ID}
					{lanes}
				/>
			{:else}
				<ControllerPreview {controller} mode="map" {lanes} lit={flashing} {laneName} />
			{/if}
		{/if}
		<LessonChart
			notes={single?.notes ?? parsed.notes}
			{lanes}
			lengthBeats={single?.lengthBeats ?? parsed.lengthBeats}
			{laneName}
			playhead={demoBeat}
		/>
		<div class="chart-actions">
			<button class="listen" class:running={demoing} onclick={toggleListen}>
				{demoing ? '■ Stop' : '▶ Listen'}
			</button>
			<span class="listen-hint">
				{demoing
					? 'Playing the groove here — nothing scored.'
					: 'Hear the groove right here: drums and backing, nothing scored.'}
			</span>
		</div>
	</div>
{/if}

{#if unplayable.length && !inSession}
	<p class="cant-play">
		Your {controller?.kind === 'edrum' ? 'kit' : 'controller'} has no
		{unplayable.map(laneName).join(' or ')} mapped, so
		{unplayable.length === 1 ? 'that note' : 'those notes'} can't be hit. The lesson still plays —
		<a href="{base}/onboarding">set it up</a> if your kit does have one.
	</p>
{/if}

{#if beyondReach && !inSession}
	<p class="cant-play">
		This lesson lands {beyondReach} hits at the same moment, and your
		{controller?.kind === 'edrum' ? 'kit' : 'controller'} reaches {controller?.voices}.
		{#if aPedalWouldDo}
			A kick pedal would free the hand you need.
		{/if}
		The lesson still plays — the notes you can't reach will score as misses.
	</p>
{/if}

{#if selected?.hints?.length && !inSession}
	<ul class="hints">
		{#each selected.hints as hint (hint)}
			<li>{hint}</li>
		{/each}
	</ul>
{/if}

<!-- The resting page keeps one shape whether or not audio is up and whether or not
	 a lesson has already been run: brief, chart, hints, Play. -->
{#if !inSession}
	<div class="launch">
		<div class="launch-nav to-prev">
			{#if prevLesson}
				<a class="lesson-nav" href="{base}/lessons/{prevLesson.id}">
					<span aria-hidden="true">←</span>
					<span class="nav-label">Previous lesson</span>
				</a>
			{/if}
		</div>

		<div class="launch-controls">
			<button class="start-btn play" onclick={() => play()} disabled={!parsed}>▶ Play</button>

			<!-- How the run is set up: tempo, how many times the lesson plays back to back,
			     and a click on every beat. Each is one unit that never breaks across lines;
			     when the row runs out of room, whole units wrap. -->
			<div class="run-options">
				<label class="opt" title="Tempo, in beats per minute">
					<span class="opt-label">BPM</span>
					<select value={selectedBpm} onchange={(e) => selectTempo(Number(e.currentTarget.value))}>
						{#each tempoOptions as v (v)}
							<option value={v}>{v}</option>
						{/each}
					</select>
					<span class="caret" aria-hidden="true">▾</span>
				</label>

				<label class="opt" title="Play the lesson this many times in a row">
					<span class="opt-label">LOOP</span>
					<select value={loops} onchange={(e) => selectLoops(Number(e.currentTarget.value))}>
						{#each LOOP_COUNTS as n (n)}
							<option value={n}>×{n}</option>
						{/each}
					</select>
					<span class="caret" aria-hidden="true">▾</span>
				</label>

				<button
					class="opt metro"
					class:on={metronome}
					aria-pressed={metronome}
					onclick={toggleMetronome}
					title="Click on every beat while the lesson plays"
				>
					<svg class="metro-glyph" viewBox="0 0 16 16" aria-hidden="true">
						<path d="M5.5 1.5h5l3 13h-11z M3.6 11h8.8" />
						<path d="M8 11 11.5 3.5" />
					</svg>Metronome
				</button>
			</div>
		</div>

		<div class="launch-nav to-next">
			{#if nextLesson}
				{#if nextUnlocked}
					<a class="lesson-nav next" href="{base}/lessons/{nextLesson.id}">
						<span class="nav-label">Next lesson</span>
						<span aria-hidden="true">→</span>
					</a>
				{:else}
					<button class="lesson-nav next locked" disabled title={nextLessonHint}>
						<span class="nav-label">Next lesson</span>
						<span class="lock" aria-hidden="true">🔒</span>
					</button>
				{/if}
			{/if}
		</div>
	</div>

	{#if status}<p class="warn">{status}</p>{/if}

	{#if audioCtx && !hasMapping}
		<p class="warn">
			{#if known.size}
				Nothing set up for this device yet — you have
				{[...known.values()].map((c) => c.name).join(', ')} configured, but that isn't what's
				plugged in. Map this one on the <a href="{base}/onboarding">Setup</a> page.
			{:else}
				No pad mapping for this device. Set one up on the
				<a href="{base}/onboarding">Setup</a> page so your hits make sound and get scored.
			{/if}
		</p>
	{/if}

	<!-- The keyboard's own reminder: its pads sit up in the Listen block, this
	     points at them and names the transport keys. -->
	{#if selectedId === VIRTUAL_KEYBOARD_ID && controller}
		<p class="device-line kbd-hint">
			Play with the highlighted keys above · <kbd>Space</kbd> start/resume ·
			<kbd>Esc</kbd> stop
		</p>
	{/if}
{/if}

{#if inSession}
	{#if playing}
		<!-- On a narrow screen the words drop and the glyphs carry the controls, so
		     the row still fits across the top instead of wrapping down over the
		     lanes the student is reading. The words stay in the accessible name. -->
		<div class="hud">
			<span class="hud-tempo"
				>{bpm} <span class="hud-word">BPM</span>{#if loops > 1}<span
						class="hud-loops"
						title="Lesson plays {loops} times in a row">×{loops}</span
					>{/if}</span
			>
			<button
				class="view-btn"
				onclick={cycleView}
				title="Cycle highway size (compact / medium / full)"
			>
				⤢ <span class="hud-word">{viewLabel}</span>
			</button>
			<button
				class="view-btn"
				class:on={metronome}
				aria-pressed={metronome}
				onclick={toggleMetronome}
				title="Metronome on/off"
			>
				<svg class="metro-glyph" viewBox="0 0 16 16" aria-hidden="true">
					<path d="M5.5 1.5h5l3 13h-11z M3.6 11h8.8" />
					<path d="M8 11 11.5 3.5" />
				</svg>
				<span class="hud-word">Metronome</span>
			</button>
			<button class="pause-btn" onclick={togglePause}>
				{#if paused}▶ <span class="hud-word">Resume</span>{:else}❚❚ <span class="hud-word"
						>Pause</span
					>{/if}
			</button>
			<button class="restart-btn" onclick={restart} title="Drop the score and start over">
				↻ <span class="hud-word">Restart</span>
			</button>
			<button class="exit" onclick={stop}>■ <span class="hud-word">Stop</span></button>
		</div>
	{/if}

	{#if parsed}
		<div
			class="highway"
			class:full={inSession}
			class:banded={view !== 'full'}
			style="height: {lanes.length * laneH}px"
		>
			<div class="labels">
				{#each lanes as note (note)}
					<div class="lane-label" class:flash={flashing.has(note)} style="height: {laneH}px">
						{laneName(note)}
					</div>
				{/each}
			</div>

			<div class="track" style="height: {lanes.length * laneH}px">
				<div class="hitline"></div>
				{#each lanes as note (note)}
					<div class="lane" style="height: {laneH}px; top: {laneRow(note) * laneH}px"></div>
				{/each}

				<div class="strip" bind:this={stripEl}>
					{#each bars() as barBeat}
						<div class="barline" style="left: {barBeat * PX_PER_BEAT}px"></div>
					{/each}
					{#each parsed.notes as n, i (i)}
						<div
							class="note {statuses[i]}"
							style="left: {n.beat * PX_PER_BEAT}px; top: {laneRow(n.note) * laneH +
								laneH / 2 -
								NOTE / 2}px; {statuses[i] === 'pending'
								? `background: ${laneColor(n.note, laneRow(n.note))}`
								: ''}"
						></div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if playing && runPreview && hasPadLayout && controller && !isVirtual}
		<div class="run-preview">
			<ControllerPreview
				{controller}
				mode="play"
				size={runPreview}
				{lanes}
				lit={flashing}
				{laneName}
			/>
		</div>
	{/if}

	<!-- The touch source taps its pads during the run too: they float low over the
	     highway so the scrolling notes stay visible. The keyboard needs no overlay —
	     it plays from the keys, and the HUD already carries start/pause. -->
	{#if playing && selectedId === VIRTUAL_TOUCH_ID && controller}
		<VirtualPads {controller} lit={flashing} cue={cueSounds} onhit={virtualHit} overlay />
	{/if}

	{#if report}
		<div class="report">
			<!-- The body scrolls, the actions do not. On a phone the report fills the
			     screen and the per-pad table is easily taller than it, so without this
			     "Try again" would be below the fold of a screen-sized dialog. -->
			<div class="report-body">
				<div class="grade-head">
				<span class="grade grade-{report.grade}">{report.grade}</span>
					<div>
						<h2>{report.gradeLabel}</h2>
						<p class="sub">{Math.round(report.accuracy * 100)}% of notes hit</p>
					</div>
				</div>
				<div class="scoreline">
					<span class="chip perfect">{report.perfect} perfect</span>
					<span class="chip good">{report.good} good</span>
					<span class="chip off">{report.off} off</span>
					<span class="chip miss">{report.miss} missed</span>
					{#if report.extra}<span class="chip extra">{report.extra} extra</span>{/if}
				</div>
				<p class="timing">
					Avg timing error <strong>{Math.round(report.avgAbsMs)} ms</strong>
					({report.early} early / {report.late} late) over {report.hits}/{report.total} notes.
				</p>
				<table>
					<thead>
						<tr><th>Pad</th><th>Hit</th><th>Avg error</th></tr>
					</thead>
					<tbody>
						{#each report.lanes as l (l.note)}
							<tr>
								<td>{l.name}</td>
								<td>{l.hits}/{l.total}</td>
								<td>{l.hits ? Math.round(l.avgMs) + ' ms' : '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="report-actions">
				<button class="play" onclick={() => play()}>Try again</button>
				{#if nextLesson && nextUnlocked}
					<button class="lesson-nav next" onclick={toNextLesson}>
						<span class="nav-label">Next lesson</span>
						<span aria-hidden="true">→</span>
					</button>
				{:else}
					<button class="done" onclick={exitReport}>Done</button>
				{/if}
			</div>
		</div>
	{/if}
{/if}

<QuoteOfTheDay open={quoteOpen} onAdvance={advanceToNext} />

<style>
	.back {
		display: inline-block;
		margin-top: 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-muted);
		text-decoration: none;
	}

	.back:hover {
		color: var(--text);
	}

	h1 {
		margin-top: 0.25rem;
	}

	/* The number is position, the name is identity — so it reads as a label
	   beside the title rather than part of it. */
	h1 .number {
		margin-right: 0.6rem;
		font-family: var(--font-mono);
		font-size: 0.75em;
		color: var(--text-muted);
	}

	/* Pattern reference while the transport is at rest — same chart the catalogue shows. */
	.chart-frame {
		margin: 0 0 1rem;
		padding: 0.55rem 0.7rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}

	/* With a controller to show, the frame becomes two columns — device on the
	   left, chart on the right — and the actions row dissolves into that same grid
	   (display: contents) so Listen lands squarely under the pads and its hint
	   under the chart. Nothing is nested crookedly: one grid, two columns, and the
	   button's left and right edges are the controller's. */
	.chart-frame.with-pads {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		column-gap: 0.9rem;
		row-gap: 0.5rem;
	}

	.chart-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin: 0.5rem 0.2rem 0.15rem;
	}

	.with-pads .chart-actions {
		display: contents;
	}

	.with-pads .listen {
		width: 100%;
		min-width: 0;
	}

	.listen {
		font-size: 0.9rem;
		padding: 0.35em 0.9em;
		min-width: 6.5em;
	}

	.listen.running {
		border-color: var(--gold);
		color: var(--gold);
	}

	.listen-hint {
		font-size: 0.82rem;
		color: var(--text-faint);
	}

	/* A gap between the kit and the lesson, said plainly and once. Not an alarm:
	   the lesson is still playable and the wording says so. */
	.cant-play {
		margin: 0 0 1.25rem;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--gold-dim);
		border-radius: var(--radius-sm);
		background: rgba(240, 192, 64, 0.07);
		color: var(--text-muted);
		font-size: 0.88rem;
	}

	.device-line {
		margin: 0.5rem 0 0;
		color: var(--text-faint);
		font-size: 0.82rem;
	}

	.kbd-hint kbd {
		display: inline-block;
		padding: 0.05rem 0.35rem;
		border: 1px solid var(--border, #3a3a3a);
		border-radius: 0.3rem;
		background: var(--surface-2, #26262b);
		font-size: 0.78em;
	}

	/* Reference, not lesson. The playing highway is a fixed field with the lanes
	   banded across its middle, so this sits in the empty half below them —
	   over the field, never displacing it, and absent when there is no room. */
	.run-preview {
		position: fixed;
		left: 0;
		right: 0;
		/* Clear of the home indicator — this is exactly where a thumb reaches for
		   the pads, and exactly where the system swipe area sits. */
		bottom: calc(1.25rem + env(safe-area-inset-bottom));
		z-index: 55;
		display: flex;
		justify-content: center;
		pointer-events: none;
		opacity: 0.9;
	}

	.hints {
		margin: 0 0 1.25rem;
		padding-left: 1.1rem;
		color: var(--text-muted);
		font-size: 0.9rem;
		line-height: 1.55;
	}

	.hints li {
		margin-bottom: 0.3rem;
	}

	.hints li::marker {
		color: var(--gold);
	}

	/* Play, the run options and the two lesson links share one row and one height.

	   Three zones across the full width: step back, the controls, step forward. The
	   outer columns are equal fractions and are rendered even when empty, so the
	   controls stay centred on the first lesson (no Previous) and on an un-earned
	   one (no Next) rather than sliding as you move through the curriculum. */
	.launch {
		--ctl-h: 3.1rem;
		display: grid;
		/* The outer columns never shrink below their own label (min-content on a
		   nowrap link is its full width), and the middle one is allowed to go to
		   zero — so options too wide for the row wrap inside their own column
		   instead of crushing "Previous lesson" down to its arrow. An absent link
		   has a min-content of 0, which is what keeps the controls centred on the
		   first lesson. */
		grid-template-columns:
			minmax(min-content, 1fr)
			minmax(0, auto)
			minmax(min-content, 1fr);
		align-items: center;
		gap: 0.75rem;
		margin: 2rem 0 0.5rem;
	}

	.launch-nav {
		display: flex;
		min-width: 0;
	}

	.launch-nav.to-prev {
		justify-content: flex-start;
	}

	.launch-nav.to-next {
		justify-content: flex-end;
	}

	.launch-controls {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	/* Narrow: one column. Play and the options stack full width, and the two lesson
	   links share the row beneath — the pair reads as "where am I" once, instead of
	   pushing the options off the screen to sit beside them. */
	@media (max-width: 46rem) {
		/* The controller keeps its place beside the chart on a phone — the two only
		   make sense read together — so only the gap between them gives way here;
		   the pads shrink themselves (see controller-preview.svelte). */
		.chart-frame.with-pads {
			column-gap: 0.55rem;
		}
	}

	/* Stacked from tablet width down: one row needs both lesson links, Play and all
	   three options side by side (~57rem), and anything narrower used to push Play
	   up above the options mid-row. */
	@media (max-width: 60rem) {
		.launch {
			grid-template-columns: 1fr 1fr;
			grid-template-areas:
				"controls controls"
				"to-prev to-next";
		}

		.launch-controls {
			grid-area: controls;
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}

		.launch-nav.to-prev {
			grid-area: to-prev;
		}

		.launch-nav.to-next {
			grid-area: to-next;
		}

		.launch-controls .start-btn {
			width: 100%;
		}

		.launch-nav .lesson-nav {
			flex: 1;
			justify-content: center;
		}

		/* Full width under a full-width Play button, so the options share the row
		   instead of huddling at the left. They only grow — past their own width
		   they wrap as whole units. */
		.launch-controls .opt {
			flex: 1 0 auto;
			justify-content: center;
		}
	}

	/* Run options — resting page only, so a run can never change its own tempo or
	   length underneath itself. Each option is a single bordered unit, caption and
	   value together, that never wraps inside itself (the native <select> is styled
	   in place, so its popup, keyboard and touch behaviour stay the platform's). */
	.run-options {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.opt {
		position: relative;
		display: inline-flex;
		align-items: stretch;
		flex: 0 0 auto;
		height: var(--ctl-h);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
	}

	.opt:focus-within {
		outline: 2px solid var(--gold);
		outline-offset: 1px;
	}

	.opt-label {
		display: flex;
		align-items: center;
		padding: 0 0.6rem;
		background: var(--surface);
		border-right: 1px solid var(--border-strong);
		color: var(--text-faint);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		letter-spacing: 0.04em;
	}

	.opt select {
		appearance: none;
		-webkit-appearance: none;
		flex: 1 1 auto;
		min-width: 0;
		height: 100%;
		margin: 0;
		padding: 0 1.7rem 0 0.7rem;
		border: none;
		border-radius: 0;
		background: transparent;
		color: inherit;
		font-family: var(--font-mono);
		font-size: 0.95rem;
		cursor: pointer;
	}

	.opt select:focus {
		outline: none; /* the unit carries the ring, see .opt:focus-within */
	}

	.opt select option {
		background: var(--surface);
		color: var(--text);
	}

	.opt:hover {
		background: var(--surface-3, var(--border));
	}

	.opt .caret {
		position: absolute;
		right: 0.6rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		font-size: 0.75rem;
		pointer-events: none;
	}

	.opt.metro {
		align-items: center;
		gap: 0.4rem;
		padding: 0 0.9rem;
		color: var(--text-muted);
		font: inherit;
		font-size: 0.95rem;
		cursor: pointer;
	}

	.opt.metro:focus-visible {
		outline: 2px solid var(--gold);
		outline-offset: 1px;
	}

	.opt.metro.on {
		color: var(--gold);
		border-color: var(--gold);
		background: color-mix(in srgb, var(--gold) 12%, var(--surface-2));
	}

	.metro-glyph {
		width: 1.05rem;
		height: 1.05rem;
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.view-btn.on {
		color: var(--gold);
		border-color: var(--gold);
	}

	.view-btn .metro-glyph {
		vertical-align: -0.15em;
	}

	/* Both curriculum links — Previous beside the controls, Next there and in the
	   result report. One style, so stepping back and stepping on look like the same
	   kind of move. */
	.lesson-nav {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		height: var(--ctl-h, auto);
		padding: 0.5em 1.1rem;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		color: var(--text);
		font: inherit;
		font-size: 0.95rem;
		text-decoration: none;
		white-space: nowrap;
		min-width: 0;
		cursor: pointer;
	}

	.lesson-nav:hover {
		border-color: var(--gold);
		color: var(--gold);
	}

	/* A button, not a link, because there is nowhere to go yet. Same footprint as
	   the earned version so the row does not reflow when it opens. */
	.lesson-nav.locked {
		font-family: inherit;
		color: var(--text-faint);
		background: var(--surface);
		border-style: dashed;
		cursor: not-allowed;
	}

	.lesson-nav.locked:hover {
		border-color: var(--border-strong);
		color: var(--text-faint);
	}

	.lesson-nav .lock {
		font-size: 0.85em;
		opacity: 0.75;
	}

	/* Below the smallest phones the label would wrap the arrow onto its own line;
	   the arrow alone still says which way it goes. */
	@media (max-width: 24rem) {
		.launch-nav .nav-label {
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}

	.play {
		height: var(--ctl-h, auto);
		padding: 0.5em 1.5rem;
		background: #2a7;
		color: #fff;
		border: 1px solid #185;
		border-radius: 0.3rem;
		font-weight: bold;
	}

	.description {
		margin: 0 0 1rem;
		color: #aab;
		font-size: 0.92rem;
		line-height: 1.5;
	}

	.warn {
		color: #d80;
		font-size: 0.9rem;
	}

	.highway {
		display: flex;
		border: 1px solid #333;
		border-radius: 0.5rem;
		overflow: hidden;
		background: #12121e;
		max-width: 900px;
	}

	/* The band is compact now, so full mode is a static field of the highway colour
	   filling the viewport with the lanes centred in it. Only the strip inside moves;
	   the space above and below is the same background, never animated. */
	.highway.full {
		position: fixed;
		inset: 0;
		z-index: 50;
		max-width: none;
		/* auto, not 100vh: inset:0 already fills the visible viewport and follows
		   it as mobile browser chrome retracts, whereas 100vh is the height with
		   the chrome gone and would overflow it by the height of the toolbar —
		   mid-run, while the compositor is animating. The !important is still
		   needed to beat the inline lane height the banded modes carry. */
		height: auto !important;
		align-items: center;
		border: none;
		border-radius: 0;
	}

	/* Banded (compact / medium) edges: a line top and bottom marks the strip off from
	   the static field. Both children carry it so the line runs the full width. */
	.highway.banded.full .labels,
	.highway.banded.full .track {
		border-top: 1px solid #333;
		border-bottom: 1px solid #333;
	}

	/* A tall screen — a phone held upright. The strip moves into the upper third and
	   the drum-name column is dropped, so the notes get the full width and the lower
	   half of the screen is free for the on-screen pads to sit under the thumbs. */
	@media (orientation: portrait) {
		.highway.full {
			align-items: flex-start;
			/* dvh to match the box: the highway is inset:0, i.e. the *visible*
			   viewport, so a vh-based inset would be measured against a taller box
			   than the one it is padding. */
			padding-top: 11dvh;
		}

		.highway.full .labels {
			display: none;
		}
	}

	/* Transport controls over the fullscreen highway, tempo readout included so the
	   ?bpm= override is visible while playing. */
	.hud {
		position: fixed;
		top: calc(1rem + env(safe-area-inset-top));
		right: calc(1rem + env(safe-area-inset-right));
		/* Anchored on both sides so it wraps within the screen instead of growing
		   off the left edge of it: right-anchored alone, the controls came to 327px
		   on a 320px phone and the tempo readout was cut in half. */
		left: calc(1rem + env(safe-area-inset-left));
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	/* Under 30rem the controls come to more than the screen is wide. Wrapping
	   would drop the second row onto the note band — the one part of the screen
	   that must stay clear — so the words go instead and the glyphs stand in.
	   Hidden, not removed: each button's accessible name is unchanged. */
	@media (max-width: 30rem) {
		.hud-word {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}

		.hud {
			gap: 0.4rem;
		}

		.hud button {
			padding-inline: 0.6em;
		}

		/* Set before the run and not changeable during it, so it is the first
		   read-out to give up its room to a control. */
		.hud-loops {
			display: none;
		}
	}

	/* A 320px phone holds five 44px touch targets and nothing more. Tempo is
	   fixed for the run too, so its read-out goes rather than a control. */
	@media (max-width: 22rem) {
		.hud-tempo {
			display: none;
		}
	}

	.hud-loops {
		margin-left: 0.5em;
		padding-left: 0.5em;
		border-left: 1px solid var(--border-strong);
	}

	.hud-tempo {
		white-space: nowrap;
		padding: 0.4em 0.7em;
		border-radius: 0.3rem;
		background: rgba(12, 13, 22, 0.75);
		border: 1px solid var(--border-strong);
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--gold);
	}

	.exit {
		padding: 0.5em 1em;
		font-size: 1rem;
		font-weight: bold;
		color: #fff;
		background: #a33;
		border: 1px solid #c55;
		border-radius: 0.3rem;
		cursor: pointer;
	}

	.pause-btn {
		padding: 0.5em 1em;
		font-size: 1rem;
		font-weight: bold;
		color: #fff;
		background: #357;
		border: 1px solid #579;
		border-radius: 0.3rem;
		cursor: pointer;
	}

	/* Neither Pause nor Stop: restarting is a neutral act, so it reads like the
	   view control rather than competing with the red exit for attention. */
	.restart-btn {
		padding: 0.5em 1em;
		font-size: 1rem;
		font-weight: bold;
		color: #cdd;
		background: #2a2a3e;
		border: 1px solid var(--border-strong);
		border-radius: 0.3rem;
		cursor: pointer;
	}

	.restart-btn:hover {
		color: #fff;
		background: #34344a;
	}

	.view-btn {
		padding: 0.5em 1em;
		font-size: 1rem;
		font-weight: bold;
		color: #cdd;
		background: #2a2a3e;
		border: 1px solid var(--border-strong);
		border-radius: 0.3rem;
		cursor: pointer;
	}

	.view-btn:hover {
		color: #fff;
		background: #34344a;
	}

	.labels {
		flex: 0 0 130px;
		border-right: 1px solid #333;
		background: #16162a;
		z-index: 2;
	}

	.lane-label {
		display: flex;
		align-items: center;
		padding: 0 0.75rem;
		font-family: monospace;
		font-size: 0.85rem;
		color: #bcd;
		border-bottom: 1px solid #23233a;
		transition: background 0.08s ease;
	}

	.lane-label.flash {
		background: #1a3a4e;
		color: #fff;
	}

	.track {
		position: relative;
		flex: 1;
		overflow: hidden;
	}

	.lane {
		position: absolute;
		left: 0;
		right: 0;
		border-bottom: 1px solid #20203a;
	}

	.hitline {
		position: absolute;
		left: 15%;
		top: 0;
		bottom: 0;
		width: 3px;
		background: #f0c040;
		box-shadow: 0 0 10px rgba(240, 192, 64, 0.6);
		z-index: 3;
	}

	.strip {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 15%;
		will-change: transform;
	}

	.barline {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: #33334d;
	}

	.note {
		position: absolute;
		width: 26px;
		height: 26px;
		margin-left: -13px;
		border-radius: 0.3rem;
		/* Pending notes get their drum-family colour inline (see markup); this is the
		   fallback if that is ever absent — an identity hue, never a result one.
		   Status classes below recolour a scored note into the result band. */
		background: var(--note-1);
		transition: background 0.1s ease;
		contain: layout paint;
	}

	.note.good {
		background: var(--res-good);
		box-shadow: 0 0 4px color-mix(in srgb, var(--res-good) 55%, transparent);
	}

	.note.perfect {
		background: var(--res-perfect);
		box-shadow: 0 0 8px color-mix(in srgb, var(--res-perfect) 90%, transparent);
		animation: pop 0.28s ease;
	}

	.note.off {
		background: var(--res-off);
		box-shadow: 0 0 4px color-mix(in srgb, var(--res-off) 40%, transparent);
	}

	.note.miss {
		background: var(--res-miss);
		box-shadow: none;
	}

	@keyframes pop {
		0% {
			transform: scale(1);
		}
		45% {
			transform: scale(1.7);
		}
		100% {
			transform: scale(1);
		}
	}

	/* The report floats over the frozen fullscreen highway rather than pushing it
	   out of flow, so a finished lesson never reflows the page (kills the CLS jump). */
	.report {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 60;
		width: min(500px, calc(100vw - 2rem));
		max-height: 90dvh;
		display: flex;
		flex-direction: column;
		padding: 1rem 1.25rem;
		border: 1px solid #2a2a3a;
		border-radius: 0.5rem;
		background: #16162a;
		box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
	}

	.report-body {
		overflow: auto;
		/* The scroll lives here rather than on .report so the actions below stay
		   put; -webkit-overflow-scrolling keeps it momentum-scrolling on iOS. */
		-webkit-overflow-scrolling: touch;
	}

	.report-actions {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	/* Below the breakpoint the report is the screen, not a card on it: a 500px
	   dialog centred in a 390px viewport is mostly margin, and its actions end up
	   wherever the table happens to end. 48rem is MOBILE_BREAKPOINT_REM in
	   $lib/breakpoints.ts.
	   Still position: fixed and still an overlay — the frozen highway underneath
	   must not reflow when this appears or goes (that reflow was a 0.52 CLS). */
	@media (max-width: 48rem) {
		.report {
			/* inset alone: it already resets the top/left the centred card sets, and
			   re-declaring either as `auto` after it puts the sheet back on its
			   static position — which reads as a half-height bottom sheet. */
			inset: 0;
			transform: none;
			width: auto;
			max-height: none;
			border: none;
			border-radius: 0;
			padding: calc(1rem + env(safe-area-inset-top)) calc(1.25rem + env(safe-area-inset-right))
				calc(1rem + env(safe-area-inset-bottom)) calc(1.25rem + env(safe-area-inset-left));
		}

		.report-body {
			flex: 1;
			min-height: 0;
		}

		/* Thumb reach: the actions sit at the bottom of the sheet and stay there
		   however long the per-pad table is. */
		.report-actions {
			position: sticky;
			bottom: 0;
			padding-top: 0.85rem;
			margin-top: auto;
			border-top: 1px solid #2a2a3a;
			background: #16162a;
		}

		.report-actions button {
			flex: 1 1 auto;
			min-height: 48px;
		}
	}

	.done {
		background: #333;
		color: #ddd;
		border: 1px solid #555;
		border-radius: 0.3rem;
		font-weight: bold;
		padding: 0.4em 0.9em;
		cursor: pointer;
	}

	.report h2 {
		margin: 0;
		font-size: 1.2rem;
	}

	.grade-head {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.grade {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: 0.5rem;
		font-size: 1.8rem;
		font-weight: bold;
		font-family: monospace;
		color: #fff;
		background: #444;
	}

	/* The grade is the coarsest result there is, so it walks the result band end
	   to end: green at S, through amber, to red at E. Hue now falls monotonically
	   with the grade (it used to rise from S to A, and A sat at hue 168 — a teal
	   that had drifted out of the band and within 37° of the hi-hat note colour).
	   White on every step clears 3:1 at this size. */
	.grade-S {
		background: #3ca059; /* oklch(.63 .14 150) */
	}
	.grade-A {
		background: #749331; /* oklch(.62 .13 125) */
	}
	.grade-B {
		background: #998700; /* oklch(.62 .13 100) */
	}
	.grade-C {
		background: #a87520; /* oklch(.60 .115 75) */
	}
	.grade-D {
		background: #ae5528; /* oklch(.55 .13  45) */
	}
	.grade-E {
		background: #a43b38; /* oklch(.50 .14  25) */
	}

	.sub {
		margin: 0.15rem 0 0;
		font-size: 0.85rem;
		color: #99a;
	}

	.scoreline {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}

	.chip {
		padding: 0.2em 0.6em;
		border-radius: 1em;
		font-size: 0.8rem;
		font-weight: bold;
	}

	/* Each chip is its own result hue, tinted into the page for the fill and
	   lifted toward the text colour for the label — so the scoreline reads with
	   the same vocabulary as the notes it is counting. "perfect" used to be teal
	   on cyan, which is now note-identity territory. All four clear 4.5:1. */
	.chip.perfect {
		background: color-mix(in srgb, var(--res-perfect) 18%, var(--bg));
		color: color-mix(in srgb, var(--res-perfect) 70%, var(--text));
	}
	.chip.good {
		background: color-mix(in srgb, var(--res-good) 18%, var(--bg));
		color: color-mix(in srgb, var(--res-good) 70%, var(--text));
	}
	.chip.off {
		background: color-mix(in srgb, var(--res-off) 18%, var(--bg));
		color: color-mix(in srgb, var(--res-off) 70%, var(--text));
	}
	.chip.miss {
		background: color-mix(in srgb, var(--res-miss) 18%, var(--bg));
		color: color-mix(in srgb, var(--res-miss) 70%, var(--text));
	}
	/* Extra hits are not a grade on a target note, so they stay out of both
	   bands and read as neutral. */
	.chip.extra {
		background: var(--surface-3);
		color: var(--text-muted);
	}

	.timing {
		font-size: 0.9rem;
		color: #ccd;
	}

	.report table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
		margin: 0.5rem 0 1rem;
	}

	.report th,
	.report td {
		text-align: left;
		padding: 0.3em 0.5em;
		border-bottom: 1px solid #2a2a3a;
	}

	.start-btn {
		font-size: 1.15rem;
		cursor: pointer;
		/* Play keeps its size whatever the options beside it do — options wrapping
		   to a second line must not squeeze it onto two lines too. */
		flex: 0 0 auto;
		white-space: nowrap;
	}
</style>
