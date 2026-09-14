<!--
	"Hit each pad once" — the step that learns which note an instrument sends for
	each pad on its picture.

	It owns the walk (which pad is lit, what has been taken, undo/skip/restart) and
	nothing else: the caller feeds it notes and is told when the walk is done.

	`audition` and `flashHit` are deliberately private copies rather than shared
	with the pedals and test steps. They are four lines each, and the alternative —
	hoisting `hitIndex` into the caller — would give three steps one flash state to
	trip over each other with.
-->
<script lang="ts">
	import { Controller, isDrumNote } from '$lib/controller.svelte';
	import { DrumPlayer } from '$lib/drums';
	import { audioContext, unlockAudio } from '$lib/scale';
	import ControllerPreview from '$lib/controller-preview.svelte';
	import { ROLE_LABELS, type DrumRole } from '$lib/presets';

	let {
		controller,
		soundOn = $bindable(true),
		index = $bindable(0),
		total = $bindable(0),
		editable = false,
		pedalsNext = false,
		notesAreGm = false,
		oncomplete
	}: {
		controller: Controller;
		soundOn?: boolean;
		/** Bindable so the caller can render the footer controls and the counter. */
		index?: number;
		total?: number;
		/** A kit the student described themselves: its drums can be named and re-roled here. */
		editable?: boolean;
		/** Say so when a footswitch is waiting on the next step rather than this one. */
		pedalsNext?: boolean;
		/**
		 * True when this instrument's note numbers are General MIDI percussion
		 * identities — a drum module. False for a grid of pads, whose numbering says
		 * nothing about which drum a pad is.
		 */
		notesAreGm?: boolean;
		oncomplete: () => void;
	} = $props();

	/**
	 * The pads this walk covers: hands only. Anything arriving via a footswitch
	 * jack is a foot, and feet are the pedals step's business — asking a student to
	 * "hit the drum lit on the picture" with their heel was always a bit of a lie.
	 *
	 * Indices are into `controller.pads`, so `index` is a position in *this* list
	 * and must be mapped through it before touching a pad.
	 */
	const order = $derived(
		controller.pads.map((p, i) => ({ p, i })).filter(({ p }) => !p.pedal).map(({ i }) => i)
	);
	$effect(() => {
		total = order.length;
	});

	let hitIndex = $state<number | null>(null);
	let hitTimer: ReturnType<typeof setTimeout>;

	const padIndex = $derived(order[index] ?? -1);
	const current = $derived(controller.pads[padIndex]);
	const pct = $derived(total ? Math.round((Math.min(index, total) / total) * 100) : 0);
	const mapped = $derived(controller.pads.filter((p) => p.note != null).length);

	/**
	 * Capture-only debounce: pads bounce a note-on twice. `Controller.handle`
	 * deliberately doesn't debounce, because a run needs every hit and a 160 ms
	 * window would swallow 16ths at 120 BPM.
	 */
	let lastNote = -1;
	let lastAt = 0;
	function bounced(note: number): boolean {
		const now = performance.now();
		if (note === lastNote && now - lastAt < 160) return true;
		lastNote = note;
		lastAt = now;
		return false;
	}

	let drumPlayer: DrumPlayer | null = null;
	function drums(): DrumPlayer | null {
		const ctx = audioContext();
		if (!ctx) return null;
		if (!drumPlayer) drumPlayer = new DrumPlayer(ctx);
		return drumPlayer;
	}

	function flashHit(i: number) {
		hitIndex = i;
		clearTimeout(hitTimer);
		hitTimer = setTimeout(() => (hitIndex = null), 140);
	}

	/**
	 * The drum the pad is mapped to — on every geometry, not only on a kit.
	 * A grid of pads is still drums, and a setup that sounds like a piano confirms
	 * nothing about the instrument the student is about to practise with.
	 */
	function audition(i: number) {
		if (!soundOn) return;
		const pad = controller.pads[i];
		if (pad) drums()?.play(controller.kitId, pad.sound);
	}

	/**
	 * A drum module that names its own pads in GM is telling us more than any
	 * profile can: the profile was written from a photograph, the module is the
	 * instrument. So a captured note we have a sample for becomes that pad's sound,
	 * overriding the suggestion. This is what stops a guessed tom layout firing the
	 * wrong drums on a unit that says otherwise.
	 *
	 * **Only for a module, never for a grid of pads.** A grid's notes are not a
	 * claim about drum identity — they are usually one chromatic run, where note 48
	 * means "the first pad", not "Hi Mid Tom". Adopting them overwrites the grid's
	 * deliberate layout, which puts kick, snare and hats on the bottom row, with
	 * whatever the controller happened to be numbered from: map a bank sending
	 * 48-63 and the kit loses its snare entirely.
	 */
	function adoptGmSound(i: number, note: number) {
		if (notesAreGm && isDrumNote(note)) controller.setPadSound(i, note);
	}

	/** Feed the walk one note-on. The caller owns the MIDI subscription. */
	export function feed(note: number) {
		if (index >= total) return;
		if (bounced(note)) return;
		const i = padIndex;
		controller.setPadNote(i, note);
		adoptGmSound(i, note);
		flashHit(i);
		audition(i);
		index++;
		if (index >= total) oncomplete();
	}

	/** Start the walk over, clearing what it has taken. */
	export function restart() {
		index = 0;
		lastNote = -1;
	}

	// The caller resets `index` directly when entering the step, because on first
	// entry this component does not exist yet to be called. Clear the bounce
	// memory with it, or the first note of a new walk can look like a repeat.
	$effect(() => {
		if (index === 0) lastNote = -1;
	});

	export function undo() {
		if (index === 0) return;
		index--;
		controller.setPadNote(order[index], null);
	}

	/**
	 * Skip the pad in front of you — available on every geometry. An instrument
	 * that cannot produce a note for every pad its picture shows must still be
	 * finishable, or the student is stuck with nothing but Restart and Back.
	 */
	export function skip() {
		if (index >= total) return;
		index++;
		if (index >= total) oncomplete();
	}

	function preview(i: number) {
		void unlockAudio();
		flashHit(i);
		audition(i);
	}

	function setRole(i: number, role: DrumRole) {
		const sound = { kick: 36, snare: 38, hihat: 42, tom: 47, crash: 49, ride: 51, perc: 39 }[role];
		controller.pads[i] = { ...controller.pads[i], role, sound };
		controller.setPads([...controller.pads]);
	}

	function setLabel(i: number, label: string) {
		controller.pads[i] = { ...controller.pads[i], label };
		controller.setPads([...controller.pads]);
	}
</script>

<div class="progress" role="progressbar" aria-valuenow={pct} aria-label="Pads mapped">
	<div class="progress-bar" style="width: {pct}%"></div>
</div>

{#if current}
	<p class="now">
		<span class="now-label">{current.label}</span>
		{#if editable}
			<select
				value={current.role}
				onchange={(e) => setRole(padIndex, e.currentTarget.value as DrumRole)}
			>
				{#each Object.entries(ROLE_LABELS) as [role, label] (role)}
					<option value={role}>{label}</option>
				{/each}
			</select>
			<input
				type="text"
				class="now-name"
				value={current.label}
				oninput={(e) => setLabel(padIndex, e.currentTarget.value)}
				aria-label="Name for this drum"
			/>
		{/if}
	</p>
{/if}

<div class="well">
	<ControllerPreview {controller} mode="capture" captureIndex={padIndex} {hitIndex} onpreview={preview} />
</div>

{#if pedalsNext}
	<p class="fine center">Feet come later — the bass and hi-hat pedals are the next step.</p>
{/if}

<label class="sound-toggle">
	<input type="checkbox" bind:checked={soundOn} />
	Play the drum on each hit
</label>

<style>
	.progress {
		height: 4px;
		border-radius: 2px;
		background: var(--border);
		overflow: hidden;
		margin-bottom: 1.25rem;
	}

	.progress-bar {
		height: 100%;
		background: var(--gold);
		transition: width 160ms ease;
	}

	.now {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin: 0 0 1rem;
	}

	.now-label {
		font-weight: 650;
		font-size: 1.05rem;
	}

	.now-name {
		flex: 1;
		min-width: 8rem;
	}

	/* Kept in step with the caller's copy: the preview hands `--pad-grid-max` down. */
	.well {
		padding: 1.25rem;
		border-radius: var(--radius);
		background: var(--surface-2);
		border: 1px solid var(--border);
	}

	.sound-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		color: var(--text-muted);
		font-size: 0.9rem;
	}
</style>
