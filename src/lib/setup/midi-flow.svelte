<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';

	import { MidiHub, type MidiInputInfo } from '$lib/midi-hub.svelte';
	import {
		KIT_PROFILES,
		kitProfile,
		cleanDeviceName,
		matchDevice,
		MAX_COLS,
		MAX_ROWS,
		ROLE_LABELS,
		type DrumRole,
		type KitProfile,
		type Preset
	} from '$lib/presets';
	import { audioContext, unlockAudio } from '$lib/scale';
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
	import CaptureLoop from '$lib/setup/capture-loop.svelte';
	import { activeInstrument } from '$lib/active-instrument.svelte';
	import { VIRTUAL_INPUTS, VIRTUAL_KEYBOARD_ID } from '$lib/virtual-input';
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

	type Step = 'connect' | 'device' | 'geometry' | 'map' | 'pedals' | 'test' | 'transport' | 'done';

	/**
	 * One flow, not three. What used to be a fork between a "grid path" and a
	 * "drum path" is now the geometry step inside this one, and "already
	 * configured" is an entry condition rather than a third path — which is what
	 * removes the `known_` special cases that used to trail it.
	 *
	 * The pedals step appears only when the chosen geometry has a footswitch,
	 * because asking about feet an instrument has not got is noise.
	 */
	const steps = $derived.by(() => {
		const list: { id: Step; label: string }[] = [
			{ id: 'connect', label: 'Connect' },
			{ id: 'device', label: 'Device' },
			{ id: 'geometry', label: 'Layout' },
			{ id: 'map', label: 'Map' }
		];
		if (pads.some((x) => x.pedal)) list.push({ id: 'pedals', label: 'Pedals' });
		list.push({ id: 'test', label: 'Try it' }, { id: 'transport', label: 'Buttons' });
		return list;
	});

	let { next = null }: { next?: string | null } = $props();

	const nextQuery = $derived(next ? `?next=${encodeURIComponent(next)}` : '');

	const midi = new MidiHub();

	let step = $state<Step>('connect');
	let controller = $state<Controller | null>(null);
	/** Which shape the instrument is. Detection pre-selects it; the student decides. */
	type Geometry = 'schematic' | 'grid' | 'neutral';
	let geometry = $state<Geometry>('grid');
	let profileId = $state<string | null>(null);
	/** Entry condition, not a path: this instrument is already configured. */
	let known_ = $state(false);
	/** Whether the geometry on screen was suggested by detection or chosen outright. */
	let suggested = $state(false);
	/** Whether any geometry has been settled at all. False until an unmatched device is answered for. */
	let picked = $state(false);
	let deviceId = $state<string | null>(null);
	let deviceName = $state('');
	let detected = $state<Preset | null>(null);
	let detectedKit = $state<KitProfile | null>(null);
	let cols = $state(4);
	let rows = $state(4);
	let captureIndex = $state(0);
	let captureTotal = $state(0);
	let loop = $state<CaptureLoop | null>(null);
	let hitIndex = $state<number | null>(null);
	let soundOn = $state(true);
	let saved = $state(false);

	// What the instrument *is*, which the controller knows once one exists. Only
	// the grid path has a stretch with no controller yet, and there it is a grid
	// by definition.
	const isKit = $derived(controller ? controller.kind === 'edrum' : geometry !== 'grid');
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

	// A detour off the active path — the pedals or buttons screens reached from the
	// short path — has no dot of its own, so it holds the last one rather than
	// leaving the rail with nothing lit.
	const stepIndex = $derived.by(() => {
		const target = step === 'done' ? steps[steps.length - 1].id : step;
		const i = steps.findIndex((s) => s.id === target);
		return i >= 0 ? i : steps.length - 1;
	});
	const mappedCount = $derived(pads.filter((p) => p.note != null).length);

	// The pedals step's own bounce filter. It used to share one pair of variables
	// with the capture walk, which meant the last pad captured could swallow the
	// first pedal gesture if they sent the same note — a footswitch that looked dead.
	let lastPedalNote = -1;
	let lastPedalAt = 0;
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

	// The wizard holds MIDI access once the student connects, so it is a surface
	// that can say which ports are really there. Publishing them is what lets the
	// header chip report presence without ever asking for access of its own.
	$effect(() => {
		activeInstrument.setPorts(midi.access ? midi.inputs.map((i) => i.id) : null);
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
		return () => {
			off();
			offRaw();
			midi.stop();
			clearTimeout(hitTimer);
		};
	});

	/** True for a repeat of the note we just took — pads bounce a note-on twice. */
	function bounced(note: number): boolean {
		const now = performance.now();
		if (note === lastPedalNote && now - lastPedalAt < 160) return true;
		lastPedalNote = note;
		lastPedalAt = now;
		return false;
	}

	function handleNote(note: number) {
		if (step === 'map') return loop?.feed(note);
		// The pedals step reads the raw stream instead (see pedalMessage): a
		// footswitch may be a note or a CC, and routing one message down both paths
		// bound the hi-hat pedal and then immediately took its note as the open hat.
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
		if (!controller) return;
		if (isDrumNote(note)) controller.setPadSound(index, note);
	}

	/** Audible confirmation on the pedals and test steps — always the real drum. */
	function audition(index: number) {
		if (!soundOn || !controller) return;
		const pad = controller.pads[index];
		if (pad) drums()?.play(controller.kitId, pad.sound);
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

		// Detection pre-selects a geometry. It never decides one: an unrecognised
		// device gets no pre-selection at all rather than being quietly called a grid,
		// which is what used to route almost every real kit into "Pad layout".
		cols = detected?.cols ?? 4;
		rows = detected?.rows ?? 4;
		customName = deviceName;
		if (detectedKit) {
			setGeometry('schematic', detectedKit.id);
		} else if (detected) {
			setGeometry('grid');
		} else {
			// Nothing matched. Offering the three shapes on equal terms means exactly
			// that: no controller yet, nothing highlighted, and no way forward until
			// the student answers. Quietly pre-selecting a grid here is the old bug.
			picked = false;
			controller = null;
		}
		step = 'geometry';
	}

	/**
	 * Build the controller for a geometry. Switching rebuilds it, because each
	 * geometry synthesises different pads — which is why changing geometry during a
	 * re-map discards the mapping and says so, while a re-map of the same geometry
	 * keeps everything but the notes.
	 */
	function setGeometry(next: Geometry, profile: string | null = null, preselected = true) {
		if (!deviceId) return;
		geometry = next;
		profileId = profile;
		suggested = preselected;
		picked = true;
		if (next === 'schematic') {
			const kit = kitProfile(profile) ?? KIT_PROFILES[0];
			controller = Controller.fromProfile(deviceId, deviceName, kit);
			profileId = kit.id;
		} else if (next === 'grid') {
			controller = Controller.grid(deviceId, deviceName, cols, rows, detected?.id ?? null);
		} else {
			customName = customName || deviceName;
			controller = Controller.custom(deviceId, customName, buildCustomPads(customCount));
		}
	}

	/** A controller this machine already knows: check it, don't re-map it. */
	function useKnown(existing: Controller) {
		known_ = true;
		controller = existing;
		deviceName = existing.name || deviceName;
		startCtrl = existing.transport.start;
		stopCtrl = existing.transport.stop;
		// Restore the geometry it was configured with, so a re-map drops into the
		// right capture path rather than re-deriving one.
		if (existing.geometry.kind === 'grid') {
			geometry = 'grid';
			cols = existing.geometry.cols;
			rows = existing.geometry.rows;
		} else if (existing.geometry.kind === 'schematic') {
			geometry = 'schematic';
			profileId = existing.profile;
		} else {
			geometry = 'neutral';
		}
		existing.hihatPreference = null; // the test is where the pedal should be felt
		testHit = null;
		testUnmapped = null;
		step = 'test';
	}

	/** "Something's wrong" — back to capture for the geometry it already has. */
	function remap() {
		known_ = false;
		startCapture();
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
		// Reset the bound index rather than calling into the loop: on the first
		// entry the component has not mounted yet, so `loop` is still null and the
		// walk would resume wherever the previous one left off.
		captureIndex = 0;
		saved = false;
		step = 'map';
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
		if (known_) {
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
		// Setting up an instrument is choosing it. `Controller.save()` no longer
		// writes the selection itself, so say both things explicitly here.
		activeInstrument.changed();
		activeInstrument.set(controller.deviceId);
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

			<!--
				The keyboard and the on-screen pads belong wherever inputs are listed,
				not only on the screen before this one. A student who connected a
				controller and then decided against it should be able to say so here
				rather than retracing their steps.
			-->
			<div class="devices virtual">
				{#each VIRTUAL_INPUTS as v (v.id)}
					<a class="device" href="{base}/onboarding/{v.id === VIRTUAL_KEYBOARD_ID ? 'keyboard' : 'touch'}{nextQuery}">
						<span class="device-text">
							<span class="device-name">{v.name}</span>
							<span class="device-mfr">No cable, nothing to map</span>
						</span>
						<span class="device-go" aria-hidden="true">→</span>
					</a>
				{/each}
			</div>
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
	{:else if step === 'geometry'}
		<WizardCard title="What does it look like?">
			{#snippet subtitle()}
				{#if suggested && geometry === 'schematic' && detectedKit?.family}
					<!-- The port only narrows this to a family, so the wizard asks rather
					     than asserts: several kits announce themselves identically. -->
					<strong>{deviceName}</strong> reports itself as a {detectedKit.family}, which is what a
					<strong>{detectedKit.label}</strong> says too. Check the picture against yours.
				{:else if suggested && geometry === 'schematic'}
					Looks like a <strong>{detectedKit?.label}</strong>. Check the picture against yours.
				{:else if suggested}
					Looks like a <strong>{detected?.label}</strong> — {cols} × {rows} pads.
				{:else}
					Nothing matched <strong>{deviceName}</strong>, so tell us its shape. Pick whichever
					picture is closest; you can change it before mapping.
				{/if}
			{/snippet}

			<div class="shapes">
				{#each KIT_PROFILES as kit (kit.id)}
					<button
						type="button"
						class="shape"
						class:on={picked && geometry === 'schematic' && profileId === kit.id}
						onclick={() => setGeometry('schematic', kit.id, false)}
					>
						<span class="shape-name">{kit.label}</span>
						<span class="tag">{kit.pads.length} drums</span>
					</button>
				{/each}
				<button
					type="button"
					class="shape"
					class:on={picked && geometry === 'grid'}
					onclick={() => setGeometry('grid', null, false)}
				>
					<span class="shape-name">A grid of pads</span>
					<span class="tag">{cols} × {rows}</span>
				</button>
				<button
					type="button"
					class="shape"
					class:on={picked && geometry === 'neutral'}
					onclick={() => setGeometry('neutral', null, false)}
				>
					<span class="shape-name">Something else</span>
					<span class="tag">{customCount} pads</span>
				</button>
			</div>

			{#if picked && geometry === 'grid'}
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
			{:else if picked && geometry === 'neutral'}
				<div class="fields">
					<label class="field">
						<span class="field-label">What is it called?</span>
						<input
							type="text"
							bind:value={customName}
							placeholder={deviceName}
							onchange={() => setGeometry('neutral', null, false)}
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

			{#if picked && controller}
				{@const c = controller}
				<div class="well">
					<ControllerPreview controller={c} mode="capture" captureIndex={-1} />
				</div>
			{/if}
			{#snippet foot()}
				<button class="ghost" onclick={() => (step = 'device')}>← Back</button>
				<button class="primary" onclick={startCapture} disabled={!picked}>
					{isKit ? 'Map drums →' : 'Map pads →'}
				</button>
			{/snippet}
		</WizardCard>
	{:else if step === 'map' && controller}
		{@const c = controller}
		<WizardCard title={isKit ? 'Hit each drum' : 'Press each pad'}>
			{#snippet subtitle()}
				{#if isKit}
					Hit the drum lit up on the picture.
				{:else}
					Left to right, top to bottom — hit the glowing pad.
				{/if}
				<strong class="count"
					>{captureIndex < captureTotal
						? `${captureIndex + 1} / ${captureTotal}`
						: 'all set!'}</strong
				>
			{/snippet}
			<CaptureLoop
				bind:this={loop}
				bind:index={captureIndex}
				bind:total={captureTotal}
				bind:soundOn
				controller={c}
				editable={c.profile === 'custom'}
				pedalsNext={kickPadIndex >= 0}
				oncomplete={finish}
			/>
			{#snippet foot()}
				<button class="ghost" onclick={() => (step = 'geometry')}>← Back</button>
				<span class="btn-group">
					<button onclick={() => loop?.undo()} disabled={captureIndex === 0}>Undo</button>
					<button onclick={() => loop?.skip()} disabled={captureIndex >= captureTotal}>Skip</button>
					<button onclick={startCapture}>Restart</button>
					{#if mappedCount > 0}
						<button class="primary" onclick={finish}>Done →</button>
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
				<button class="ghost" onclick={() => (step = known_ ? 'test' : 'map')}>
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
		<WizardCard title={known_ ? 'Check your ' + (isKit ? 'kit' : 'pads') : 'Give it a play'}>
			{#snippet subtitle()}
				{#if known_}
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
				{#if known_}
									<button class="ghost" onclick={() => (step = 'device')}>← Back</button>
								{:else}
									<button class="ghost" onclick={() => (step = 'pedals')}>← Pedals</button>
								{/if}
								<span class="btn-group">
									<button onclick={remap}>Re-map {isKit ? 'drums' : 'pads'}</button>
									{#if isKit}
										<button onclick={() => (step = 'pedals')}>Pedals</button>
									{/if}
									{#if known_}
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
									onclick={() => (step = 'test')}>← Back</button
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
								<a class="cta" href={next ?? `${base}/lessons`}>{next ? 'Back to the lesson →' : 'Start practicing →'}</a>
			{/snippet}
		</WizardCard>
	{/if}
</div>

<style>
	/* Set apart from the ports: these are always there and need no connecting. */
	.devices.virtual {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}

	.devices.virtual .device {
		text-decoration: none;
	}

	/*
		The three answers, offered as peers. What used to be here was a grid stepper
		with a text link at the bottom offering to "set it up as a kit" — the fork
		this whole change exists to bring above the fold.
	*/
	.shapes {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
	}

	.shape {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 0.9rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text);
		text-align: left;
	}

	.shape.on {
		border-color: var(--gold);
		background: var(--surface);
	}

	.shape-name {
		font-weight: 600;
	}

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

	/* --- kit step --- */

	/* A size picker's preview, not a mapper's: pads with nothing in them yet. */
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

	/* Struck — the pad lights while its key (or Hear-it) is pressed, so the student
	   sees which pad answered. */
</style>
