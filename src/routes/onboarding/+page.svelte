<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';

	import { MidiHub, type MidiInputInfo } from '$lib/midi-hub.svelte';
	import {
		KIT_PROFILES,
		cleanDeviceName,
		matchDevice,
		MAX_COLS,
		MAX_ROWS,
		ROLE_LABELS,
		type DrumRole,
		type KitProfile,
		type Preset
	} from '$lib/presets';
	import { audioContext, playScaleTone, unlockAudio } from '$lib/scale';
	import { onboardingFinished, onboardingStarted, onboardingStep } from '$lib/analytics';
	import {
		Controller,
		CLOSED_HAT,
		isDrumNote,
		OPEN_HAT,
		type ControllerSummary,
		type Pad
	} from '$lib/controller.svelte';
	import ControllerPreview from '$lib/controller-preview.svelte';
	import WizardRail from '$lib/wizard-rail.svelte';
	import WizardCard from '$lib/wizard-card.svelte';
	import {
		VIRTUAL_KEYBOARD_ID,
		VIRTUAL_TOUCH_ID,
		loadVirtualController,
		keyLabelFor,
		keyboardIndexFor
	} from '$lib/virtual-input';
	import { DrumPlayer } from '$lib/drums';
	import PageMeta from '$lib/page-meta.svelte';
	import { canShareLayouts, shareLayout } from '$lib/layout-share';
	import {
		controlLabel,
		parseControl,
		sameControl,
		type MidiControl
	} from '$lib/transport-control';

	// Everything about the instrument lives on the Controller now — the wizard's
	// job is to build one and hand it to `save()`. See controller.svelte.ts.

	type Step =
		| 'connect'
		| 'device'
		| 'grid'
		| 'kit'
		| 'map'
		| 'sounds'
		| 'pedals'
		| 'test'
		| 'transport'
		| 'done';

	/**
	 * Three paths sharing their first two steps. The rail renders whichever is
	 * active, so the number of dots always matches the number of screens the
	 * student will actually walk.
	 *
	 * `known` is the short one: a controller this machine has already been set up
	 * against needs proving, not re-mapping. Pressing every pad again to arrive
	 * back where you started is a chore, so a recognised device goes straight to
	 * the test — and re-mapping is one button away from there if it turns out to
	 * be wrong.
	 */
	type Path = 'grid' | 'edrum' | 'known' | 'virtual';
	const PATHS: Record<Path, { id: Step; label: string }[]> = {
		// The virtual path has no device to connect and no note to capture: pick the
		// keyboard or the on-screen pads, then choose which drum each pad plays.
		virtual: [
			{ id: 'connect', label: 'Source' },
			{ id: 'sounds', label: 'Pads' }
		],
		known: [
			{ id: 'connect', label: 'Connect' },
			{ id: 'device', label: 'Device' },
			{ id: 'test', label: 'Check' }
		],
		grid: [
			{ id: 'connect', label: 'Connect' },
			{ id: 'device', label: 'Device' },
			{ id: 'grid', label: 'Grid' },
			{ id: 'map', label: 'Map pads' },
			{ id: 'transport', label: 'Transport' }
		],
		edrum: [
			{ id: 'connect', label: 'Connect' },
			{ id: 'device', label: 'Device' },
			{ id: 'kit', label: 'Kit' },
			{ id: 'map', label: 'Map drums' },
			{ id: 'pedals', label: 'Pedals' },
			{ id: 'test', label: 'Test' },
			{ id: 'transport', label: 'Transport' }
		]
	};

	const midi = new MidiHub();

	let step = $state<Step>('connect');
	let path = $state<Path>('grid');
	let controller = $state<Controller | null>(null);
	let deviceId = $state<string | null>(null);
	let deviceName = $state('');
	let detected = $state<Preset | null>(null);
	let detectedKit = $state<KitProfile | null>(null);
	let cols = $state(4);
	let rows = $state(4);
	let captureIndex = $state(0);
	let hitIndex = $state<number | null>(null);
	let soundOn = $state(true);
	let saved = $state(false);

	// What the instrument *is*, which the controller knows once one exists. Only
	// the grid path has a stretch with no controller yet, and there it is a grid
	// by definition.
	const isKit = $derived(controller ? controller.kind === 'edrum' : path === 'edrum');
	const pads = $derived(controller?.pads ?? []);

	/** Controllers already configured on this machine, so the list can say so. */
	let known = $state(new Map<string, ControllerSummary>());

	// Transport step: Play / Stop buttons, if the controller has any. Both are
	// optional — plenty of pad units are just pads.
	type Slot = 'start' | 'stop';
	const SLOTS: { id: Slot; label: string; hint: string }[] = [
		{ id: 'start', label: 'Play / Start', hint: 'Starts a lesson and resumes after a pause' },
		{ id: 'stop', label: 'Stop / Pause', hint: 'Pauses the run; press again to stop it' }
	];
	let startCtrl = $state<MidiControl | null>(null);
	let stopCtrl = $state<MidiControl | null>(null);
	let arming = $state<Slot | null>(null);
	let ctrlHint = $state('');

	// Pedals step. The bass pedal is one press; the hi-hat takes three gestures,
	// because guessing a kit's wiring is how you get a hat that scores as the
	// wrong drum (see classifyHihat below).
	//
	// Every gesture is skippable on its own and the whole step is skippable, so a
	// kit with one pedal, the other, or neither all set up fine. Plenty of people
	// own the module and not the footswitches.
	type Gesture = 'kick' | 'pedal' | 'open' | 'closed';
	const GESTURES: { id: Gesture; label: string; hint: string; group: 'bass' | 'hihat' }[] = [
		{
			id: 'kick',
			label: 'Press the bass pedal',
			hint: 'The kick footswitch — one press is enough',
			group: 'bass'
		},
		{
			id: 'pedal',
			label: 'Press the hi-hat pedal',
			hint: 'Hold it down, then let go',
			group: 'hihat'
		},
		{ id: 'open', label: 'Hit the hi-hat, pedal up', hint: 'Let the hat ring open', group: 'hihat' },
		{
			id: 'closed',
			label: 'Hit the hi-hat, pedal down',
			hint: 'Hold the pedal and strike',
			group: 'hihat'
		}
	];
	/** Only offer the bass row to a kit that says it has a kick footswitch. */
	const gestures = $derived(
		GESTURES.filter((g) => g.group !== 'bass' || pads.some((p) => p.pedal === 'kick'))
	);
	const kickPadIndex = $derived(pads.findIndex((p) => p.pedal === 'kick'));
	let gesture = $state<Gesture | null>(null);
	let pedalCtrl = $state<MidiControl | null>(null);
	let openNote = $state<number | null>(null);
	let closedNote = $state<number | null>(null);
	let pedalHint = $state('');

	// Test step
	let testHit = $state<{ label: string; drum: string } | null>(null);
	let testUnmapped = $state<number | null>(null);
	/** GM note -> drum name, from the render manifest; empty until it loads. */
	let drumNames = $state(new Map<number, string>());
	/** The drum catalogue as an ordered list, for the virtual pad dropdowns. */
	const drumOptions = $derived([...drumNames.entries()].map(([note, name]) => ({ note, name })));

	// Generic path
	let customName = $state('');
	let customCount = $state(7);
	let shareState = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle');

	/**
	 * The pads the "hit each drum" loop walks: hands only. Anything arriving via a
	 * footswitch jack is a foot, and feet are the pedals step's business — mapping
	 * a kick by asking the student to "hit the drum lit on the picture" was always
	 * a bit of a lie, and it left the bass pedal with nowhere to be skipped.
	 *
	 * Indices are into `controller.pads`, so `captureIndex` is a position in *this*
	 * list and has to be mapped through it before touching a pad.
	 */
	const captureOrder = $derived(
		pads.map((p, i) => ({ p, i })).filter(({ p }) => !p.pedal).map(({ i }) => i)
	);
	const padIndex = $derived(captureOrder[captureIndex] ?? -1);
	const total = $derived(controller ? captureOrder.length : cols * rows);
	const pct = $derived(total ? Math.round((Math.min(captureIndex, total) / total) * 100) : 0);
	const steps = $derived(PATHS[path]);
	// A detour off the active path — the pedals or buttons screens reached from the
	// short path — has no dot of its own, so it holds the last one rather than
	// leaving the rail with nothing lit.
	const stepIndex = $derived.by(() => {
		const target = step === 'done' ? steps[steps.length - 1].id : step;
		const i = steps.findIndex((s) => s.id === target);
		return i >= 0 ? i : steps.length - 1;
	});
	const mappedCount = $derived(pads.filter((p) => p.note != null).length);

	// note-capture debounce (pads can bounce a note-on twice). Capture only —
	// `Controller.handle` deliberately doesn't debounce, because a run needs every
	// hit and a 160 ms window would swallow 16ths at 120 BPM.
	let lastNote = -1;
	let lastAt = 0;
	let hitTimer: ReturnType<typeof setTimeout>;

	// Real drum samples on the kit path: on an e-drum kit the point of mapping is
	// to hear your own snare when you hit the snare, which a scale tone can't do.
	let drumPlayer: DrumPlayer | null = null;
	function drums(): DrumPlayer | null {
		const ctx = audioContext();
		if (!ctx) return null;
		if (!drumPlayer) drumPlayer = new DrumPlayer(ctx);
		return drumPlayer;
	}

	// Which step the student is on is the one thing worth measuring here — the wizard
	// is where a new drummer either gets their pads working or gives up, and the step
	// they were last on says which. Reported off `step` rather than from each
	// transition so every route into a screen counts, Back included; only the finish
	// is once-per-visit, so a student who steps back out of "done" and returns is not
	// counted as having set up twice.
	let reportedStep: Step | null = null;
	let reportedFinish = false;

	$effect(() => {
		const current = step;
		if (current === reportedStep) return;
		reportedStep = current;
		onboardingStep(current);
		if (current === 'done' && !reportedFinish) {
			reportedFinish = true;
			onboardingFinished();
		}
	});

	onMount(() => {
		onboardingStarted();
		known = new Map(Controller.list().map((c) => [c.deviceId, c]));
		// Best-effort: without it the test step names the note instead of the drum,
		// which is worse but not broken.
		fetch(`${base}/drums/manifest.json`)
			.then((r) => (r.ok ? r.json() : null))
			.then((m) => {
				if (m?.drums) {
					drumNames = new Map(
						m.drums.map((d: { note: number; name: string }) => [d.note, d.name])
					);
				}
			})
			.catch(() => {});
		const off = midi.onNote(handleNote);
		const offRaw = midi.onMessage(handleMessage);
		window.addEventListener('keydown', soundsKeydown);
		return () => {
			off();
			offRaw();
			midi.stop();
			window.removeEventListener('keydown', soundsKeydown);
			clearTimeout(hitTimer);
		};
	});

	/** True for a repeat of the note we just took — pads bounce a note-on twice. */
	function bounced(note: number): boolean {
		const now = performance.now();
		if (note === lastNote && now - lastAt < 160) return true;
		lastNote = note;
		lastAt = now;
		return false;
	}

	function handleNote(note: number) {
		if (step === 'map') return captureNote(note);
		// The pedals step reads the raw stream instead (see pedalMessage): a
		// footswitch may be a note or a CC, and routing one message down both paths
		// bound the hi-hat pedal and then immediately took its note as the open hat.
	}

	function captureNote(note: number) {
		if (!controller || captureIndex >= total) return;
		if (bounced(note)) return;

		const i = padIndex;
		controller.setPadNote(i, note);
		adoptGmSound(i, note);
		flashHit(i);
		audition(i);

		captureIndex++;
		if (captureIndex >= total) finish();
	}

	/**
	 * A drum module that names its own pads in GM is telling us more than any
	 * profile can: the profile was written from a photograph, the module is the
	 * instrument. So on a kit, a captured note we have a sample for becomes that
	 * pad's sound, overriding the suggestion.
	 *
	 * This is what stops a guessed tom layout (47, 45) from firing the wrong
	 * drums on a unit that actually sends 45 and 43.
	 */
	function adoptGmSound(index: number, note: number) {
		if (!controller || !isKit) return;
		if (isDrumNote(note)) controller.setPadSound(index, note);
	}

	/** Audible confirmation of a capture: the real drum on a kit, a tone on a grid. */
	function audition(index: number) {
		if (!soundOn || !controller) return;
		const pad = controller.pads[index];
		if (isKit && pad) drums()?.play(controller.kitId, pad.sound);
		else playScaleTone(index, total);
	}

	// Transport capture listens to the raw stream, not just note-ons: a Play
	// button may send a CC or a single-byte MIDI Start instead of a note.
	function handleMessage(data: Uint8Array) {
		if (step === 'pedals') return pedalMessage(data);
		if (step === 'test') return testMessage(data);
		if (step !== 'transport' || !arming) return;
		const hit = parseControl(data);
		if (!hit || !hit.pressed) return; // releases and clock are not presses
		const { control } = hit;

		// A pad we just mapped is not a transport button — say so instead of
		// silently binding the kick to Play.
		if (control.kind === 'note' && isPadNote(control.data1)) {
			ctrlHint = `That's one of your pads (note ${control.data1}). Press a Play or Stop button.`;
			return;
		}
		if (sameControl(control, pedalCtrl)) {
			ctrlHint = "That's your hi-hat pedal. Press a Play or Stop button.";
			return;
		}
		const other = arming === 'start' ? stopCtrl : startCtrl;
		if (sameControl(control, other)) {
			ctrlHint = 'That button is already taken by the other slot.';
			return;
		}

		ctrlHint = '';
		if (arming === 'start') {
			startCtrl = control;
			arming = 'stop'; // roll straight on to the Stop button
		} else {
			stopCtrl = control;
			arming = null;
			save();
		}
	}

	const isPadNote = (note: number) =>
		pads.some((p) => p.note === note || p.altNote === note);

	// --- pedals: discover the hi-hat rather than declaring it ----------------
	//
	// Real kits do one of three things and mostly don't say which. Asking the
	// student would be worse — most people don't know — so three gestures decide
	// it in about the time it takes to read the question.

	function pedalMessage(data: Uint8Array) {
		if (!gesture) return;
		const hit = parseControl(data);
		if (!hit || !hit.pressed) return;
		const { control } = hit;

		if (gesture === 'pedal') {
			// A pad is not a pedal. Without this the student who taps the hat instead
			// of pressing the pedal binds their hi-hat as its own pedal.
			if (control.kind === 'note' && isPadNote(control.data1)) {
				pedalHint = "That's a pad, not the pedal. Press the footswitch itself.";
				return;
			}
			pedalHint = '';
			pedalCtrl = control;
			nextGesture();
			return;
		}

		// The rest are struck: a kick footswitch and the hi-hat both send notes.
		if (control.kind === 'note') pedalNote(control.data1);
	}

	function pedalNote(note: number) {
		if (bounced(note)) return;
		pedalHint = '';
		if (gesture === 'kick') {
			// A kick footswitch is a trigger: it sends a note like any pad, it is
			// just played with a foot.
			if (kickPadIndex >= 0) {
				controller?.setPadNote(kickPadIndex, note);
				adoptGmSound(kickPadIndex, note);
				audition(kickPadIndex);
			}
			nextGesture();
			save();
		} else if (gesture === 'open') {
			openNote = note;
			gesture = 'closed';
		} else if (gesture === 'closed') {
			closedNote = note;
			gesture = null;
			classifyHihat();
		}
	}

	/** Advance to the next gesture in the active list, or finish the step. */
	function nextGesture() {
		const i = gestures.findIndex((g) => g.id === gesture);
		const next = gestures[i + 1];
		if (next) {
			gesture = next.id;
		} else {
			gesture = null;
			classifyHihat();
		}
	}

	/**
	 * Two notes beats stateful wherever both are observed: it needs no state to
	 * be correct, so nothing can drift out of sync mid-run.
	 */
	function classifyHihat() {
		if (!controller) return;
		const i = controller.pads.findIndex((p) => p.role === 'hihat');
		if (i < 0) return;
		const pad = controller.pads[i];

		if (openNote != null && closedNote != null && openNote !== closedNote) {
			controller.hihat = {
				mode: 'two-note',
				pedal: null,
				closed: CLOSED_HAT,
				open: OPEN_HAT
			};
			controller.pads[i] = {
				...pad,
				note: closedNote,
				sound: CLOSED_HAT,
				altNote: openNote,
				altSound: OPEN_HAT
			};
		} else if (pedalCtrl && (openNote != null || closedNote != null)) {
			controller.hihat = {
				mode: 'stateful',
				pedal: pedalCtrl,
				closed: CLOSED_HAT,
				open: OPEN_HAT
			};
			controller.pads[i] = {
				...pad,
				note: closedNote ?? openNote ?? pad.note,
				sound: CLOSED_HAT,
				altNote: null
			};
		} else {
			// No usable pedal. One voice — and canPlay() will tell the lesson page
			// to say so rather than letting open-hat notes read as unexplained misses.
			controller.hihat = {
				mode: 'none',
				pedal: null,
				closed: CLOSED_HAT,
				open: OPEN_HAT
			};
			controller.pads[i] = {
				...pad,
				note: closedNote ?? openNote ?? pad.note,
				sound: CLOSED_HAT,
				altNote: null
			};
		}
		controller.setPads([...controller.pads]);
		controller.hihatPosition = controller.hihat.mode === 'stateful' ? 'closed' : null;
		save();
	}

	function startPedals() {
		pedalHint = '';
		pedalCtrl = null;
		openNote = null;
		closedNote = null;
		gesture = gestures[0]?.id ?? null;
	}

	/** Skip this gesture alone; whatever it would have set stays unset. */
	function skipGesture() {
		pedalHint = '';
		nextGesture();
	}

	/** Skip the rest of the hi-hat gestures, keeping anything already captured. */
	function skipHihat() {
		pedalHint = '';
		gesture = null;
		classifyHihat();
	}

	const anyPedalSet = $derived(
		!!pedalCtrl || openNote != null || closedNote != null || (kickPadIndex >= 0 && pads[kickPadIndex]?.note != null)
	);

	const hihatSummary = $derived.by(() => {
		const mode = controller?.hihat.mode;
		if (mode === 'two-note') return 'Two notes — open and closed are separate pads to us.';
		if (mode === 'stateful')
			return `Pedal tracked on ${controlLabel(controller?.hihat.pedal ?? null)} — one pad, two voices.`;
		return 'No hi-hat pedal — your hat plays closed only.';
	});

	/** Both feet, so a skipped bass pedal is stated rather than silently absent. */
	const pedalSummary = $derived.by(() => {
		const parts: string[] = [];
		if (kickPadIndex >= 0) {
			parts.push(
				pads[kickPadIndex]?.note != null
					? `Bass pedal on note ${pads[kickPadIndex].note}.`
					: 'No bass pedal — nothing will play the kick.'
			);
		}
		parts.push(hihatSummary);
		return parts.join(' ');
	});

	// --- test: prove it before the first lesson ------------------------------

	function testMessage(data: Uint8Array) {
		if (!controller) return;
		const ev = controller.handle(data);
		if (ev.kind === 'hit') {
			const i = controller.pads.indexOf(ev.pad);
			flashHit(i);
			testUnmapped = null;
			// The drum's name, not just the pad's: "Pad 14" says nothing about
			// whether the mapping is right, and checking the mapping is the whole
			// point of this step.
			testHit = { label: ev.pad.label, drum: drumNames.get(ev.note) ?? `note ${ev.note}` };
			drums()?.play(controller.kitId, ev.note);
		} else if (ev.kind === 'unmapped') {
			// Silence here would look exactly like a dead pad. Say what arrived.
			testHit = null;
			testUnmapped = ev.note;
		}
	}

	const slotControl = (slot: Slot) => (slot === 'start' ? startCtrl : stopCtrl);

	function armSlot(slot: Slot) {
		ctrlHint = '';
		arming = slot;
	}

	function clearSlot(slot: Slot) {
		ctrlHint = '';
		if (slot === 'start') startCtrl = null;
		else stopCtrl = null;
		if (arming === slot) arming = null;
		save();
	}

	function flashHit(i: number) {
		hitIndex = i;
		clearTimeout(hitTimer);
		hitTimer = setTimeout(() => (hitIndex = null), 140);
	}

	// --- step transitions --------------------------------------------------

	async function connect() {
		await unlockAudio(); // this click is our audio-unlock gesture
		const ok = await midi.connect();
		if (ok) step = 'device';
	}

	async function pair() {
		await unlockAudio();
		await midi.pairBluetooth();
		if (midi.access) step = 'device';
	}

	/**
	 * The branch. A kit routes straight into the drum path with its schematic
	 * already up; anything else keeps the grid path exactly as it was. Returning
	 * to this step discards the choice, so a wrong guess costs one click.
	 */
	function selectDevice(info: MidiInputInfo) {
		deviceId = info.id;
		// Cleaned: some modules append invisible bidi characters to their strings,
		// and this name is stored and shown everywhere afterwards.
		deviceName = cleanDeviceName(info.name);
		midi.listen(info.id);
		saved = false;
		shareState = 'idle';

		// The maker is half the identity — a drum module is often OEM hardware whose
		// own name says nothing (see deviceIdentity).
		const match = matchDevice(info.name, info.manufacturer);
		detected = match?.kind === 'grid' ? match.preset : null;
		detectedKit = match?.kind === 'edrum' ? match.profile : null;

		// Already set up against this machine? Then there is nothing to learn from
		// pressing every pad again. Load it and go straight to proving it works.
		const existing = Controller.load(info.id);
		if (existing && existing.pads.some((p) => p.note != null)) {
			useKnown(existing);
			return;
		}

		if (detectedKit) {
			useProfile(detectedKit);
		} else {
			path = 'grid';
			controller = null;
			cols = detected?.cols ?? 4;
			rows = detected?.rows ?? 4;
			step = 'grid';
		}
	}

	/** A controller this machine already knows: check it, don't re-map it. */
	function useKnown(existing: Controller) {
		path = 'known';
		controller = existing;
		deviceName = existing.name || deviceName;
		startCtrl = existing.transport.start;
		stopCtrl = existing.transport.stop;
		if (existing.geometry.kind === 'grid') {
			cols = existing.geometry.cols;
			rows = existing.geometry.rows;
		}
		existing.hihatPreference = null; // the test is where the pedal should be felt
		testHit = null;
		testUnmapped = null;
		step = 'test';
	}

	/** "Something's wrong" — drop into the full mapping path for what this is. */
	function remap() {
		path = controller?.kind === 'edrum' ? 'edrum' : 'grid';
		startCapture();
	}

	function useProfile(profile: KitProfile) {
		if (!deviceId) return;
		path = 'edrum';
		controller = Controller.fromProfile(deviceId, deviceName, profile);
		step = 'kit';
	}

	/** "My kit isn't listed" — the generic path, as complete as a profiled one. */
	function useCustomKit() {
		if (!deviceId) return;
		path = 'edrum';
		customName = customName || deviceName;
		controller = Controller.custom(deviceId, customName, buildCustomPads(customCount));
		step = 'kit';
	}

	/**
	 * The virtual path: a computer keyboard or the on-screen pads. There is no
	 * device to connect and no note to capture, so this jumps straight to choosing
	 * which drum each pad plays, seeded from the source's saved (or default)
	 * mapping. The keyboard's key positions are fixed; only the drums are editable.
	 */
	function useVirtual(id: string) {
		void unlockAudio();
		path = 'virtual';
		deviceId = id;
		controller = loadVirtualController(id);
		deviceName = controller.name;
		startCtrl = null;
		stopCtrl = null;
		saved = false;
		shareState = 'idle';
		step = 'sounds';
	}

	function setVirtualSound(i: number, sound: number) {
		controller?.setPadSound(i, sound);
		saved = false;
	}

	function previewVirtual(i: number) {
		void unlockAudio();
		const pad = controller?.pads[i];
		if (pad && controller) drums()?.play(controller.kitId, pad.sound);
		flashHit(i); // light the pad, however it was struck — tap or key
	}

	// While mapping the keyboard's sounds, a physical key does what it will do in a
	// lesson: light its pad and play the drum it is set to, so the student hears and
	// sees the mapping they are editing.
	function soundsKeydown(e: KeyboardEvent) {
		if (step !== 'sounds' || deviceId !== VIRTUAL_KEYBOARD_ID) return;
		const el = e.target as HTMLElement | null;
		if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA'))
			return;
		if (e.repeat) return;
		const i = keyboardIndexFor(e.code);
		if (i === -1 || i >= (controller?.pads.length ?? 0)) return;
		e.preventDefault();
		previewVirtual(i);
	}

	function buildCustomPads(n: number): Pad[] {
		const shape: { label: string; role: DrumRole; sound: number }[] = [
			{ label: 'Kick', role: 'kick', sound: 36 },
			{ label: 'Snare', role: 'snare', sound: 38 },
			{ label: 'Hi-hat', role: 'hihat', sound: CLOSED_HAT },
			{ label: 'Tom 1', role: 'tom', sound: 48 },
			{ label: 'Tom 2', role: 'tom', sound: 47 },
			{ label: 'Floor tom', role: 'tom', sound: 45 },
			{ label: 'Crash', role: 'crash', sound: 49 },
			{ label: 'Ride', role: 'ride', sound: 51 }
		];
		return Array.from({ length: Math.max(1, n) }, (_, i) => {
			const s = shape[i] ?? { label: `Drum ${i + 1}`, role: 'perc' as DrumRole, sound: 39 };
			return { id: `drum-${i}`, label: s.label, role: s.role, note: null, sound: s.sound };
		});
	}

	function setCustomCount(n: number) {
		customCount = Math.max(1, Math.min(16, n));
		if (controller?.profile === 'custom') {
			controller.setPads(buildCustomPads(customCount));
		}
	}

	function setPadLabel(i: number, label: string) {
		if (!controller) return;
		controller.pads[i] = { ...controller.pads[i], label };
		controller.setPads([...controller.pads]);
	}

	function setPadRole(i: number, role: DrumRole) {
		if (!controller) return;
		const sound = { kick: 36, snare: 38, hihat: CLOSED_HAT, tom: 47, crash: 49, ride: 51, perc: 39 }[
			role
		];
		controller.pads[i] = { ...controller.pads[i], role, sound };
		controller.setPads([...controller.pads]);
	}

	/** Leave the kit path for the grid one — a pad unit misdetected as a kit. */
	function useGrid() {
		path = 'grid';
		controller = null;
		detectedKit = null;
		cols = 4;
		rows = 4;
		step = 'grid';
	}

	function setCols(n: number) {
		cols = Math.max(1, Math.min(MAX_COLS, n));
	}
	function setRows(n: number) {
		rows = Math.max(1, Math.min(MAX_ROWS, n));
	}

	/** True when the existing controller is already the shape we are about to map. */
	function fitsGrid(c: Controller | null): boolean {
		return (
			!!c &&
			c.kind === 'grid' &&
			c.geometry.kind === 'grid' &&
			c.geometry.cols === cols &&
			c.geometry.rows === rows
		);
	}

	function startCapture() {
		if (!deviceId) return;
		if (!isKit && !fitsGrid(controller)) {
			// A fresh grid controller: its pads are synthesised from the size, so the
			// capture loop is identical to the kit's.
			controller = Controller.grid(deviceId, deviceName, cols, rows, detected?.id ?? null);
			controller.transport = { start: startCtrl, stop: stopCtrl };
		} else if (controller) {
			// Re-mapping something that already exists: clear the notes and keep
			// everything else, so a re-map doesn't throw away edited sounds, labels
			// or a hi-hat classification that was correct.
			controller.setPads(controller.pads.map((p) => ({ ...p, note: null, altNote: null })));
		}
		captureIndex = 0;
		lastNote = -1;
		saved = false;
		step = 'map';
	}

	function undo() {
		if (captureIndex === 0 || !controller) return;
		captureIndex--;
		controller.setPadNote(captureOrder[captureIndex], null);
	}

	/** Skip the drum in front of you: left unmapped, not filled with a placeholder. */
	function skipPad() {
		if (captureIndex >= total) return;
		captureIndex++;
		if (captureIndex >= total) finish();
	}

	// Pads done. The grid path goes straight to transport as it always did; a kit
	// has pedals to sort out and a test to pass first.
	function finish() {
		save();
		ctrlHint = '';
		if (isKit) {
			step = 'pedals';
			if (controller?.hihat.mode === 'none') startPedals();
			return;
		}
		step = 'transport';
		// Guide the first pass; a re-map keeps buttons already captured, so don't
		// arm over them.
		arming = startCtrl || stopCtrl ? null : 'start';
	}

	function finishPedals() {
		gesture = null;
		save();
		testHit = null;
		testUnmapped = null;
		step = 'test';
	}

	function finishTest() {
		// A known controller already has its buttons; there is nothing to capture,
		// so confirming the check is the end of it.
		if (path === 'known') {
			save();
			step = 'done';
			return;
		}
		step = 'transport';
		arming = startCtrl || stopCtrl ? null : 'start';
	}

	function finishTransport() {
		arming = null;
		save();
		step = 'done';
	}

	function save() {
		if (!controller) return;
		controller.transport = { start: startCtrl, stop: stopCtrl };
		controller.name = isKit ? controller.name || deviceName : deviceName;
		controller.save();
		saved = true;
	}

	/** Opt-in, one shot, and the setup is already saved either way. */
	async function share() {
		if (!controller || shareState === 'sending' || shareState === 'sent') return;
		shareState = 'sending';
		shareState = (await shareLayout(controller)) ? 'sent' : 'failed';
	}

	function previewPad(i: number) {
		unlockAudio();
		audition(i);
	}
</script>

<PageMeta
	title="Groove Academy — Set up your pads"
	description="Point the browser at your MIDI kit, tap each pad once, and Groove Academy learns the layout. No kit? The on-screen pads work too."
/>

<div class="wizard">
	<WizardRail {steps} {stepIndex} />

	{#if step === 'connect'}
		<WizardCard title="Connect your pads">
			{#snippet subtitle()}
				Plug in a USB-MIDI controller, or pair a Bluetooth-MIDI pad. No account
				needed.
			{/snippet}
			{#if midi.error}
				<p class="alert">{midi.error}</p>
			{/if}
			<div class="connect-actions">
				<button class="primary big" onclick={connect} disabled={!midi.supported}>
					Connect USB / MIDI
				</button>
				{#if midi.bluetoothSupported}
					<button class="big" onclick={pair}>Pair Bluetooth pad</button>
				{/if}
			</div>
			<p class="fine">
				{#if !midi.supported}
					This browser has no Web MIDI support. Use Chrome, Edge, or Opera on desktop or Android.
				{:else}
					Your browser will ask permission to use MIDI devices.
				{/if}
			</p>
			<!-- No controller, or a phone with no Web MIDI at all: the keyboard and the
			     on-screen pads play a lesson on their own. -->
			<div class="virtual-entry">
				<span class="virtual-or">No controller?</span>
				<span class="btn-group">
					<button onclick={() => useVirtual(VIRTUAL_KEYBOARD_ID)}>Use your keyboard</button>
					<button onclick={() => useVirtual(VIRTUAL_TOUCH_ID)}>Use on-screen pads</button>
				</span>
			</div>
		</WizardCard>
	{:else if step === 'device'}
		<WizardCard title="Choose your device">
			{#snippet subtitle()}
				{midi.inputs.length
					? 'Pick the controller you want to set up.'
					: 'No MIDI inputs found yet — connect a pad and rescan.'}
			{/snippet}
			{#if midi.error}
				<p class="alert">{midi.error}</p>
			{/if}
			{#if midi.inputs.length}
				<div class="devices">
					{#each midi.inputs as input (input.id)}
						{@const match = matchDevice(input.name, input.manufacturer)}
						{@const seen = known.get(input.id)}
						<button type="button" class="device" onclick={() => selectDevice(input)}>
							<span class="device-text">
								<span class="device-name">{cleanDeviceName(input.name)}</span>
								<span class="device-mfr">
									{#if seen}
										Set up already · {seen.padCount}
										{seen.kind === 'edrum' ? 'drums' : 'pads'}
									{:else if input.manufacturer}
										{cleanDeviceName(input.manufacturer)}
									{/if}
								</span>
							</span>
							{#if match?.kind === 'edrum'}
								<span class="tag">{match.profile.label}</span>
							{:else if match?.kind === 'grid'}
								<span class="tag">{match.preset.cols}×{match.preset.rows}</span>
							{/if}
							<span class="device-go" aria-hidden="true">→</span>
						</button>
					{/each}
				</div>
			{:else}
				<div class="empty">
					<span class="empty-icon" aria-hidden="true">🎛</span>
					<span>Waiting for a controller…</span>
				</div>
			{/if}
			{#snippet foot()}
				<button class="ghost" onclick={() => (step = 'connect')}>← Back</button>
								<span class="btn-group">
									<button onclick={() => midi.refresh()}>Rescan</button>
									{#if midi.bluetoothSupported}
										<button onclick={pair}>Pair Bluetooth</button>
									{/if}
								</span>
			{/snippet}
		</WizardCard>
	{:else if step === 'grid'}
		<WizardCard title="Pad layout">
			{#snippet subtitle()}
				{#if detected}
					Detected <strong>{detected.label}</strong> — adjust if it looks wrong.
				{:else}
					No preset matched for <strong>{deviceName}</strong>. Set your grid size.
				{/if}
			{/snippet}
			<div class="steppers">
				<div class="stepper">
					<span class="stepper-label">Columns</span>
					<span class="stepper-controls">
						<button class="square" onclick={() => setCols(cols - 1)} disabled={cols <= 1}>−</button>
						<span class="stepper-value">{cols}</span>
						<button class="square" onclick={() => setCols(cols + 1)} disabled={cols >= MAX_COLS}>+</button>
					</span>
				</div>
				<span class="steppers-x" aria-hidden="true">×</span>
				<div class="stepper">
					<span class="stepper-label">Rows</span>
					<span class="stepper-controls">
						<button class="square" onclick={() => setRows(rows - 1)} disabled={rows <= 1}>−</button>
						<span class="stepper-value">{rows}</span>
						<button class="square" onclick={() => setRows(rows + 1)} disabled={rows >= MAX_ROWS}>+</button>
					</span>
				</div>
			</div>
			<div class="well compact">
				<div class="grid-preview" style="grid-template-columns: repeat({cols}, minmax(0, 1fr));">
					{#each Array(cols * rows) as _, i (i)}<span class="ghost-pad"></span>{/each}
				</div>
				<p class="fine center">{cols} × {rows} = {cols * rows} pad{cols * rows === 1 ? '' : 's'}</p>
			</div>
			<p class="fine center">
				Playing an electronic drum kit rather than a grid of pads?
				<button class="link" onclick={useCustomKit}>Set it up as a kit</button>.
			</p>
			{#snippet foot()}
				<button class="ghost" onclick={() => (step = 'device')}>← Back</button>
								<button class="primary" onclick={startCapture}>Map pads →</button>
			{/snippet}
		</WizardCard>
	{:else if step === 'kit' && controller}
		<WizardCard title={detectedKit ? 'Is this your kit?' : 'Describe your kit'}>
			{#snippet subtitle()}
				{#if detectedKit?.family}
					<!-- The port only narrows this to a family, so the wizard asks rather
					than asserts: several kits announce themselves identically. -->
					Your module reports itself as <strong>{deviceName}</strong>, which makes it a
					{detectedKit.family} — the same thing a <strong>{detectedKit.label}</strong> says.
					Several kits share it, so check the picture against yours: this is the MD-90's
					layout, hi-hat and all.
				{:else if detectedKit}
					Detected <strong>{detectedKit.label}</strong>. Its drums are laid out below as they
					sit on the unit — check it looks like yours before mapping.
				{:else}
					No profile matched <strong>{deviceName}</strong>, so tell us the shape of it and we'll
					map the drums one by one.
				{/if}
			{/snippet}

			{#if !detectedKit}
				<div class="fields">
					<label class="field">
						<span class="field-label">Kit name</span>
						<input
							type="text"
							bind:value={customName}
							placeholder={deviceName}
							onchange={() => controller && (controller.name = customName || deviceName)}
						/>
					</label>
					<div class="stepper">
						<span class="stepper-label">Pads</span>
						<span class="stepper-controls">
							<button class="square" onclick={() => setCustomCount(customCount - 1)} disabled={customCount <= 1}>−</button>
							<span class="stepper-value">{customCount}</span>
							<button class="square" onclick={() => setCustomCount(customCount + 1)} disabled={customCount >= 16}>+</button>
						</span>
					</div>
				</div>
			{/if}

			<div class="well">
				<ControllerPreview {controller} mode="capture" captureIndex={-1} />
			</div>

			<details class="switcher">
				<summary>Not your kit?</summary>
				<div class="switch-list">
					{#each KIT_PROFILES as p (p.id)}
						<button type="button" class="device" onclick={() => useProfile(p)}>
							<span class="device-name">{p.label}</span>
							<span class="tag">{p.pads.length} drums</span>
						</button>
					{/each}
					<button type="button" class="device" onclick={useCustomKit}>
						<span class="device-name">My kit isn't listed</span>
						<span class="tag">custom</span>
					</button>
					<button type="button" class="device" onclick={useGrid}>
						<span class="device-name">It's a pad grid, not a kit</span>
						<span class="tag">grid</span>
					</button>
				</div>
			</details>
			{#snippet foot()}
				<button class="ghost" onclick={() => (step = 'device')}>← Back</button>
								<button class="primary" onclick={startCapture}>Map drums →</button>
			{/snippet}
		</WizardCard>
	{:else if step === 'map' && controller}
		<!-- Through captureOrder, never raw: captureIndex is a position in the
		     capture list, and pedal pads are absent from it. Reading pads
		     directly named one drum while the picture lit another and the
		     label/role editors below edited a third. -->
		{@const current = controller.pads[padIndex]}
		<WizardCard title={isKit ? 'Hit each drum' : 'Press each pad'}>
			{#snippet subtitle()}
				{#if isKit}
					Hit the drum lit up on the picture.
				{:else}
					Left to right, top to bottom — hit the glowing pad.
				{/if}
				<strong class="count">{captureIndex < total
						? `${captureIndex + 1} / ${total}`
						: 'all set!'}</strong>
			{/snippet}
			<div class="progress" role="progressbar" aria-valuenow={pct} aria-label="Pads mapped">
				<div class="progress-bar" style="width: {pct}%"></div>
			</div>

			{#if isKit && current}
				<p class="now">
					<span class="now-label">{current.label}</span>
					{#if controller.profile === 'custom'}
						<select
							value={current.role}
							onchange={(e) => setPadRole(padIndex, e.currentTarget.value as DrumRole)}
						>
							{#each Object.entries(ROLE_LABELS) as [role, label] (role)}
								<option value={role}>{label}</option>
							{/each}
						</select>
						<input
							type="text"
							class="now-name"
							value={current.label}
							oninput={(e) => setPadLabel(padIndex, e.currentTarget.value)}
							aria-label="Name for this drum"
						/>
					{/if}
				</p>
			{/if}

			<div class="well">
				<ControllerPreview
					{controller}
					mode="capture"
					captureIndex={padIndex}
					{hitIndex}
					onpreview={previewPad}
				/>
			</div>
			{#if isKit && kickPadIndex >= 0}
				<p class="fine center">Feet come later — the bass and hi-hat pedals are the next step.</p>
			{/if}
			<label class="sound-toggle">
				<input type="checkbox" bind:checked={soundOn} />
				{isKit ? 'Play the drum on each hit' : 'Play an A-minor tone on each press'}
			</label>
			{#snippet foot()}
				<button class="ghost" onclick={() => (step = isKit ? 'kit' : 'grid')}>← Back</button>
								<span class="btn-group">
									<button onclick={undo} disabled={captureIndex === 0}>Undo</button>
									{#if isKit}
										<button onclick={skipPad} disabled={captureIndex >= total}>Skip</button>
									{/if}
									<button onclick={startCapture}>Restart</button>
									{#if isKit && mappedCount > 0}
										<button class="primary" onclick={finish}>Done →</button>
									{/if}
								</span>
			{/snippet}
		</WizardCard>
	{:else if step === 'sounds' && controller}
		<WizardCard title={deviceId === VIRTUAL_KEYBOARD_ID ? 'Your keyboard pads' : 'Your on-screen pads'}>
			{#snippet subtitle()}
				{#if deviceId === VIRTUAL_KEYBOARD_ID}
					The keys are fixed — pick the drum each one plays. <kbd>Space</kbd> starts and
					resumes a lesson, <kbd>Esc</kbd> pauses and stops.
				{:else}
					Pick the drum each pad plays. Tap a pad in a lesson to hit it.
				{/if}
			{/snippet}

			<div class="sound-grid">
				{#each controller.pads as pad, i (pad.id)}
					<div class="sound-cell" class:hit={hitIndex === i}>
						<div class="sound-head">
							{#if deviceId === VIRTUAL_KEYBOARD_ID && keyLabelFor(i)}
								<kbd class="key">{keyLabelFor(i)}</kbd>
							{:else}
								<span class="pad-num">{i + 1}</span>
							{/if}
							<button class="preview" onclick={() => previewVirtual(i)} title="Hear it">
								{drumNames.get(pad.sound) ?? pad.sound}
							</button>
						</div>
						<select
							class="drum-select"
							value={pad.sound}
							onchange={(e) => setVirtualSound(i, Number(e.currentTarget.value))}
							aria-label={'Drum for pad ' + (i + 1)}
						>
							{#each drumOptions as d (d.note)}
								<option value={d.note}>{d.name}</option>
							{/each}
						</select>
					</div>
				{/each}
			</div>
			{#snippet foot()}
				<button class="ghost" onclick={() => (step = 'connect')}>← Back</button>
								<span class="btn-group">
									{#if saved}
										<span class="saved-note">Saved ✓</span>
										<a class="cta" href="{base}/lessons">Start practicing →</a>
									{:else}
										<button class="primary" onclick={save}>Save</button>
									{/if}
								</span>
			{/snippet}
		</WizardCard>
	{:else if step === 'pedals' && controller}
		<!-- Above the card, not inside it: a `{@const}` among the children is scoped to
		     that snippet, so the subtitle and footer snippets could not see it. -->
		{@const g = gestures.find((x) => x.id === gesture)}
		<WizardCard title="Pedals">
			{#snippet subtitle()}
				Your feet, if you have them plugged in. The bass pedal is one press; the hi-hat
				takes three, because kits disagree about how a hi-hat works and guessing gets it
				wrong. <strong>Skip anything you haven't got</strong> — each one on its own, or the
				lot. Everything else still works.
			{/snippet}

			<ol class="gestures">
				{#each gestures as item, i (item.id)}
					{@const kickNote = kickPadIndex >= 0 ? pads[kickPadIndex]?.note : null}
					{@const done =
						(item.id === 'kick' && kickNote != null) ||
						(item.id === 'pedal' && pedalCtrl) ||
						(item.id === 'open' && openNote != null) ||
						(item.id === 'closed' && closedNote != null)}
					<li
						class="gesture"
						class:armed={gesture === item.id}
						class:set={!!done}
						class:group-start={i > 0 && gestures[i - 1].group !== item.group}
					>
						<span class="gesture-num">{i + 1}</span>
						<span class="slot-text">
							<span class="slot-label">{item.label}</span>
							<span class="slot-hint">{item.hint}</span>
						</span>
						<span class="slot-value">
							{#if gesture === item.id}
								<span class="listening">Waiting…</span>
							{:else if item.id === 'kick' && kickNote != null}
								<span class="tag">note {kickNote}</span>
							{:else if item.id === 'pedal' && pedalCtrl}
								<span class="tag">{controlLabel(pedalCtrl)}</span>
							{:else if item.id === 'open' && openNote != null}
								<span class="tag">note {openNote}</span>
							{:else if item.id === 'closed' && closedNote != null}
								<span class="tag">note {closedNote}</span>
							{:else}
								<span class="slot-empty">skipped</span>
							{/if}
						</span>
					</li>
				{/each}
			</ol>

			{#if pedalHint}
				<p class="fine center">{pedalHint}</p>
			{:else if g}
				<p class="fine center">{g.hint}.</p>
			{:else}
				<p class="fine center verdict">{pedalSummary}</p>
			{/if}
			{#snippet foot()}
				<button class="ghost" onclick={() => (step = path === 'known' ? 'test' : 'map')}>
									← Back
								</button>
								<span class="btn-group">
									{#if gesture}
										<button onclick={skipGesture}>Skip this one</button>
										{#if g?.group === 'hihat'}
											<button onclick={skipHihat}>No hi-hat pedal</button>
										{/if}
									{:else}
										<button onclick={startPedals}>{anyPedalSet ? 'Redo' : 'Start'}</button>
									{/if}
									<button class="primary" onclick={finishPedals}>
										{gesture ? 'Skip the rest →' : 'Done →'}
									</button>
								</span>
			{/snippet}
		</WizardCard>
	{:else if step === 'test' && controller}
		<WizardCard title={path === 'known' ? 'Check your ' + (isKit ? 'kit' : 'pads') : 'Give it a play'}>
			{#snippet subtitle()}
				{#if path === 'known'}
					<strong>{deviceName}</strong> is already set up, so there's nothing to map — just
					make sure it still lines up. Hit anything: you'll hear the drum it plays and see
					it light up. If any of it is wrong, re-map from here.
				{:else}
					Hit anything. The drum you struck lights up on the picture and is named below it —
					if it's the wrong one, fix it now rather than mid-lesson.
				{/if}
			{/snippet}
			<div class="well">
				<ControllerPreview {controller} mode="capture" captureIndex={-1} {hitIndex} />
			</div>
			<p class="fine center" aria-live="polite">
				{#if testUnmapped != null}
					<span class="unmapped">Note {testUnmapped} isn't mapped to any drum.</span>
				{:else if testHit}
					<span class="hit-name">{testHit.label}</span>
					<span class="hit-drum">plays {testHit.drum}</span>
				{:else}
					Waiting for a hit…
				{/if}
			</p>
			{#if controller.profile === 'custom' && canShareLayouts}
				<p class="fine center share">
					{#if shareState === 'sent'}
						Sent — thank you. If we ship a profile for it, your setup will be waiting.
					{:else if shareState === 'failed'}
						Couldn't send that just now. Your setup is saved either way.
					{:else}
						Send us this layout — the kit's name, its drums and their notes, nothing else —
						and we may ship it as a profile.
						<button class="link" onclick={share} disabled={shareState === 'sending'}>
							{shareState === 'sending' ? 'Sending…' : 'Share layout'}
						</button>
					{/if}
				</p>
			{/if}
			{#snippet foot()}
				{#if path === 'known'}
									<button class="ghost" onclick={() => (step = 'device')}>← Back</button>
								{:else}
									<button class="ghost" onclick={() => (step = 'pedals')}>← Pedals</button>
								{/if}
								<span class="btn-group">
									<button onclick={remap}>Re-map {isKit ? 'drums' : 'pads'}</button>
									{#if isKit}
										<button onclick={() => (step = 'pedals')}>Pedals</button>
									{/if}
									{#if path === 'known'}
										<button
											onclick={() => {
												step = 'transport';
												armSlot('start');
											}}>Buttons</button
										>
									{/if}
									<button class="primary" onclick={finishTest}>Looks right →</button>
								</span>
			{/snippet}
		</WizardCard>
	{:else if step === 'transport'}
		<WizardCard title="Transport buttons">
			{#snippet subtitle()}
				Has your controller got Play and Stop buttons? Press them now and they'll start and
				pause lessons. If it hasn't, skip — the on-screen buttons work either way.
			{/snippet}
			<div class="slots">
				{#each SLOTS as slot (slot.id)}
					{@const ctrl = slotControl(slot.id)}
					<button
						type="button"
						class="slot"
						class:armed={arming === slot.id}
						class:set={!!ctrl}
						onclick={() => armSlot(slot.id)}
					>
						<span class="slot-text">
							<span class="slot-label">{slot.label}</span>
							<span class="slot-hint">{slot.hint}</span>
						</span>
						<span class="slot-value">
							{#if arming === slot.id}
								<span class="listening">Press it…</span>
							{:else if ctrl}
								<span class="tag">{controlLabel(ctrl)}</span>
							{:else}
								<span class="slot-empty">Not set</span>
							{/if}
						</span>
					</button>
				{/each}
			</div>
			{#if ctrlHint}
				<p class="fine center">{ctrlHint}</p>
			{:else}
				<p class="fine center">
					{arming === 'start'
						? 'Waiting for your Play button…'
						: arming === 'stop'
							? 'Now press Stop — or skip to finish with just Play.'
							: 'Tap a row to re-record that button.'}
				</p>
			{/if}
			{#snippet foot()}
				<button
									class="ghost"
									onclick={() => (step = path === 'known' || isKit ? 'test' : 'map')}>← Back</button
								>
								<span class="btn-group">
									{#if startCtrl || stopCtrl}
										<button
											onclick={() => {
												clearSlot('start');
												clearSlot('stop');
												armSlot('start');
											}}>Clear</button
										>
									{/if}
									<button class="primary" onclick={finishTransport}>
										{startCtrl || stopCtrl ? 'Done →' : 'Skip →'}
									</button>
								</span>
			{/snippet}
		</WizardCard>
	{:else if step === 'done' && controller}
		<!-- Hoisted because a snippet compiles to a function, and TypeScript does not
		     carry the branch guard's narrowing of a mutable `let` across one. -->
		{@const c = controller}
		<WizardCard title="You're set up" align="center">
			{#snippet badge()}<span class="check" aria-hidden="true">✓</span>{/snippet}
			{#snippet subtitle()}
				{c.name} ·
				{#if isKit}
					{mappedCount} drum{mappedCount === 1 ? '' : 's'} mapped
				{:else}
					{cols}×{rows} · {mappedCount} pads mapped
				{/if}{saved ? ' and saved' : ''}.
			{/snippet}
			<div class="well">
				<ControllerPreview {controller} mode="capture" captureIndex={-1} onpreview={previewPad} />
				<p class="fine center">
					{isKit ? 'Tap a drum to hear it.' : 'Tap a pad to hear its tone.'}
				</p>
			</div>
			{#if isKit}
				<p class="fine center">{pedalSummary}</p>
			{/if}
			{#if startCtrl || stopCtrl}
				<p class="fine center">
					Transport:
					{#if startCtrl}<span class="tag">{controlLabel(startCtrl)}</span> starts{/if}{#if startCtrl && stopCtrl},
					{/if}{#if stopCtrl}<span class="tag">{controlLabel(stopCtrl)}</span> pauses{/if}.
				</p>
			{/if}
			{#snippet foot()}
				<span class="btn-group">
									<button class="ghost" onclick={() => (step = 'device')}>Switch device</button>
									<button onclick={remap}>Re-map</button>
									{#if isKit}
										<button onclick={() => (step = 'pedals')}>Pedals</button>
									{/if}
									{#if mappedCount}
										<button onclick={() => (step = 'test')}>Test</button>
									{/if}
									<button
										onclick={() => {
											step = 'transport';
											armSlot('start');
										}}>Buttons</button
									>
								</span>
								<a class="cta" href="{base}/lessons">Start practicing →</a>
			{/snippet}
		</WizardCard>
	{/if}
</div>

<style>
	.wizard {
		max-width: 560px;
		margin: 1.5rem auto 0;
	}

	.count {
		color: var(--gold);
		font-family: var(--font-mono);
	}

	.btn-group {
		display: flex;
		gap: 0.6rem;
	}

	.ghost {
		background: transparent;
		border-color: transparent;
		color: var(--text-muted);
	}

	.big {
		padding: 0.7em 1.4em;
		font-size: 1.05rem;
		flex: 1;
	}

	.square {
		width: 2.2rem;
		height: 2.2rem;
		padding: 0;
		font-size: 1.1rem;
		line-height: 1;
	}

	.cta {
		display: inline-block;
		padding: 0.45em 1.1em;
		border-radius: var(--radius-sm);
		background: var(--gold);
		border: 1px solid var(--gold);
		color: #1a1505;
		font-weight: 650;
		text-decoration: none;
		transition: background 120ms ease;
	}

	.cta:hover {
		background: #f6cd5e;
	}

	.alert {
		margin: 0 0 1.25rem;
		padding: 0.6rem 0.9rem;
		border: 1px solid rgba(224, 112, 112, 0.4);
		border-radius: var(--radius-sm);
		background: rgba(224, 112, 112, 0.08);
		color: var(--red);
		font-size: 0.9rem;
	}

	.fine {
		margin: 1rem 0 0;
		color: var(--text-faint);
		font-size: 0.85rem;
	}

	.fine.center {
		text-align: center;
	}

	.well {
		padding: 1.5rem 1.25rem 1.25rem;
		border-radius: var(--radius);
		background: rgba(0, 0, 0, 0.22);
	}

	/* smaller preview on the layout step — it's a size picker, not the mapper */
	.well.compact {
		--pad-grid-max: 300px;
	}

	/* --- connect --- */

	.connect-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	/* --- device list --- */

	.devices {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.device {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		width: 100%;
		padding: 0.85rem 1.1rem;
		text-align: left;
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
	}

	.device:hover:not(:disabled) {
		border-color: var(--gold);
		background: var(--surface-3);
	}

	.device:hover .device-go {
		color: var(--gold);
		transform: translateX(2px);
	}

	.device-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.device-name {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.device-mfr {
		font-size: 0.78rem;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tag {
		flex-shrink: 0;
		padding: 0.2em 0.55em;
		border-radius: 999px;
		background: rgba(240, 192, 64, 0.12);
		border: 1px solid var(--gold-dim);
		color: var(--gold);
		font-family: var(--font-mono);
		font-size: 0.78rem;
	}

	.device-go {
		flex-shrink: 0;
		color: var(--text-faint);
		transition:
			color 120ms ease,
			transform 120ms ease;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem 1rem;
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius);
		color: var(--text-faint);
		font-size: 0.9rem;
	}

	.empty-icon {
		font-size: 1.6rem;
		opacity: 0.7;
	}

	/* --- grid steppers --- */

	.steppers {
		display: flex;
		align-items: end;
		justify-content: center;
		gap: 1.25rem;
		margin-bottom: 1.5rem;
	}

	.steppers-x {
		padding-bottom: 0.45rem;
		color: var(--text-faint);
		font-family: var(--font-mono);
	}

	.stepper {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.45rem;
	}

	.stepper-label {
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.stepper-controls {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.stepper-value {
		min-width: 1.6rem;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 1.35rem;
		font-weight: 700;
	}

	/* --- map step --- */

	.progress {
		height: 0.45rem;
		margin-bottom: 1.25rem;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
	}

	.progress-bar {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--gold), #f6cd5e);
		transition: width 200ms ease;
	}

	.sound-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 1.1rem;
		font-size: 0.88rem;
		color: var(--text-muted);
		user-select: none;
		cursor: pointer;
	}

	/* --- kit step --- */

	/* A size picker's preview, not a mapper's: pads with nothing in them yet. */
	.grid-preview {
		display: grid;
		gap: 0.55rem;
		max-width: 300px;
		margin: 0 auto;
	}

	.ghost-pad {
		aspect-ratio: 1;
		border-radius: var(--radius);
		background: var(--surface-2);
		opacity: 0.5;
	}

	.fields {
		display: flex;
		align-items: end;
		gap: 1.25rem;
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		flex: 1;
		min-width: 12rem;
	}

	.field-label {
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.field input {
		padding: 0.5em 0.7em;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-strong);
		background: var(--surface-2);
		color: var(--text);
	}

	.switcher {
		margin-top: 1.1rem;
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.switcher summary {
		cursor: pointer;
	}

	.switch-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.link {
		padding: 0;
		border: none;
		background: none;
		color: var(--gold);
		text-decoration: underline;
		font: inherit;
		cursor: pointer;
	}

	/* --- map step: the drum in front of you --- */

	.now {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin: 0 0 1rem;
	}

	.now-label {
		font-size: 1.05rem;
		font-weight: 650;
		color: var(--gold);
	}

	.now-name {
		width: 9rem;
		padding: 0.3em 0.5em;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-strong);
		background: var(--surface-2);
		color: var(--text);
		font-size: 0.85rem;
	}

	/* --- pedals step --- */

	.gestures {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.gesture {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.8rem 1.1rem;
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
	}

	.gesture.armed {
		border-color: var(--gold);
		box-shadow: 0 0 0 1px var(--gold-dim);
	}

	.gesture.set {
		border-color: var(--green-dim);
	}

	/* A little air where the bass pedal ends and the hi-hat begins. */
	.gesture.group-start {
		margin-top: 0.5rem;
	}

	.gesture-num {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--surface-3);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--text-faint);
	}

	.verdict {
		color: var(--green);
	}

	/* --- test step --- */

	.hit-name {
		font-size: 1.05rem;
		font-weight: 650;
		color: var(--cyan);
	}

	.hit-drum {
		margin-left: 0.45rem;
		color: var(--text-muted);
	}

	.unmapped {
		color: var(--gold);
	}

	.share {
		max-width: 34rem;
		margin-left: auto;
		margin-right: auto;
	}

	/* --- transport step --- */

	.slots {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.slot {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		width: 100%;
		padding: 0.85rem 1.1rem;
		text-align: left;
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
	}

	.slot:hover:not(:disabled) {
		border-color: var(--gold);
		background: var(--surface-3);
	}

	.slot.armed {
		border-color: var(--gold);
		box-shadow: 0 0 0 1px var(--gold-dim);
	}

	.slot.set {
		border-color: var(--green-dim);
	}

	.slot-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.slot-label {
		font-weight: 600;
	}

	.slot-hint {
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.slot-value {
		flex-shrink: 0;
	}

	.slot-empty {
		color: var(--text-faint);
		font-size: 0.85rem;
	}

	.listening {
		color: var(--gold);
		font-size: 0.85rem;
		animation: pulse 1.1s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.35;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.listening {
			animation: none;
		}
	}

	/* --- done --- */

	.check {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		margin: 0 auto 0.75rem;
		border-radius: 50%;
		background: rgba(85, 187, 136, 0.15);
		border: 1px solid var(--green-dim);
		color: var(--green);
		font-size: 1.4rem;
		font-weight: 700;
	}

	/* --- virtual controllers --- */

	.virtual-entry {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1.25rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border, #333);
	}

	.virtual-or {
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.sound-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.6rem;
	}

	@media (max-width: 30rem) {
		.sound-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.sound-cell {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.5rem;
		border: 1px solid var(--border, #333);
		border-radius: var(--radius-sm, 0.5rem);
		background: var(--surface-2, #1a1a2e);
		transition:
			border-color 0.06s ease,
			background 0.06s ease;
	}

	/* Struck — the pad lights while its key (or Hear-it) is pressed, so the student
	   sees which pad answered. */
	.sound-cell.hit {
		border-color: var(--accent, #6cf);
		background: color-mix(in srgb, var(--accent, #6cf) 22%, var(--surface-2, #1a1a2e));
	}

	.sound-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
	}

	.pad-num {
		font-size: 0.85rem;
		color: var(--text-faint);
	}

	.sound-cell kbd.key {
		display: inline-block;
		padding: 0.05rem 0.4rem;
		border: 1px solid var(--border, #444);
		border-radius: 0.3rem;
		background: var(--surface, #24243e);
		font-size: 0.8rem;
		font-variant: small-caps;
	}

	.sound-cell .preview {
		flex: 1;
		padding: 0.35rem 0.3rem;
		font-size: 0.8rem;
		color: var(--text);
		background: var(--surface, #24243e);
		border: 1px solid var(--border, #3a3a5a);
		border-radius: 0.35rem;
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sound-cell .drum-select {
		width: 100%;
		padding: 0.25em;
		font-size: 0.8rem;
	}

	.saved-note {
		align-self: center;
		color: var(--green);
		font-size: 0.9rem;
	}
</style>
