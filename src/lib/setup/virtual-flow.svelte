<!--
	The keyboard and touch flows. Both are the same two screens, so they are the
	same component with a different source id.

	The shape is deliberately the opposite way round from how this used to work.
	The old virtual path opened on a grid of dropdowns — a configuration form
	presented as the task, when the default mapping is already correct and the only
	real question is how it *feels*. So try-it is the step, and the editor is a
	detour from it.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import WizardRail from '$lib/wizard-rail.svelte';
	import WizardCard from '$lib/wizard-card.svelte';
	import VirtualPads from '$lib/virtual-pads.svelte';
	import { Controller } from '$lib/controller.svelte';
	import { DrumPlayer } from '$lib/drums';
	import { audioContext, unlockAudio } from '$lib/scale';
	import { activeInstrument } from '$lib/active-instrument.svelte';
	import { onboardingFinished, onboardingStep } from '$lib/analytics';
	import {
		VIRTUAL_KEYBOARD_ID,
		TRANSPORT_START_CODE,
		TRANSPORT_STOP_CODE,
		loadVirtualController,
		keyLabelFor,
		keyboardIndexFor
	} from '$lib/virtual-input';

	let { deviceId, next = null }: { deviceId: string; next?: string | null } = $props();

	const isKeyboard = $derived(deviceId === VIRTUAL_KEYBOARD_ID);

	type Step = 'try' | 'sounds';
	let step = $state<Step>('try');

	const steps = $derived([
		{ id: 'try', label: 'Try it' },
		{ id: 'sounds', label: 'Pads' }
	]);
	const stepIndex = $derived(step === 'try' ? 0 : 1);

	let controller = $state<Controller | null>(null);
	let hitIndex = $state<number | null>(null);
	/** VirtualPads lights by GM note, not by pad position, so keep both. */
	let litNotes = $state(new Set<number>());
	let hitTimer: ReturnType<typeof setTimeout>;
	let lastDrum = $state<string | null>(null);
	/** GM note -> drum name, from the render manifest; empty until it loads. */
	let drumNames = $state(new Map<number, string>());
	const drumOptions = $derived([...drumNames.entries()].map(([note, name]) => ({ note, name })));
	let transportPressed = $state<string | null>(null);

	let drumPlayer: DrumPlayer | null = null;
	function drums(): DrumPlayer | null {
		const ctx = audioContext();
		if (!ctx) return null;
		if (!drumPlayer) drumPlayer = new DrumPlayer(ctx);
		return drumPlayer;
	}

	onMount(() => {
		controller = loadVirtualController(deviceId);
		// Setting one up is choosing it, and storing it is what makes it count as
		// configured — without this the gate would bounce the student it just
		// onboarded, because a virtual source is never in the device registry.
		controller.save();
		activeInstrument.changed();
		activeInstrument.set(deviceId);
		onboardingStep('try');

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

		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('keydown', onKey);
			clearTimeout(hitTimer);
		};
	});

	function flash(i: number, gm: number) {
		hitIndex = i;
		litNotes = new Set([gm]);
		clearTimeout(hitTimer);
		hitTimer = setTimeout(() => {
			hitIndex = null;
			litNotes = new Set();
		}, 140);
	}

	/** By pad position — the key layout and the editor's preview button. */
	function hit(i: number) {
		const pad = controller?.pads[i];
		if (pad) hitGm(pad.sound);
	}

	/** By GM note — what the on-screen pads report, exactly as a lesson receives it. */
	function hitGm(gm: number) {
		void unlockAudio();
		if (!controller) return;
		const i = controller.pads.findIndex((p) => p.sound === gm);
		flash(i, gm);
		lastDrum = drumNames.get(gm) ?? `Note ${gm}`;
		drums()?.play(controller.kitId, gm);
	}

	function onKey(e: KeyboardEvent) {
		const el = e.target as HTMLElement | null;
		if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
		if (el?.isContentEditable) return;
		if (e.repeat) return;

		// Report the transport keys rather than acting on them: there is no run here
		// to start. Only when nothing interactive holds focus, so Space still
		// activates a focused button and Escape still dismisses.
		// "Nothing interactive holds focus". document.activeElement is the reliable
		// signal: a key event that reaches the window can report its target as the
		// window itself, which is not the body.
		const focused = document.activeElement;
		const bare =
			!focused || focused === document.body || focused === document.documentElement;
		if (isKeyboard && bare && (e.code === TRANSPORT_START_CODE || e.code === TRANSPORT_STOP_CODE)) {
			e.preventDefault();
			transportPressed =
				e.code === TRANSPORT_START_CODE ? 'Space — starts and resumes a lesson' : 'Esc — pauses, then stops';
			return;
		}
		if (!isKeyboard) return;
		const i = keyboardIndexFor(e.code);
		if (i === -1 || i >= (controller?.pads.length ?? 0)) return;
		e.preventDefault();
		hit(i);
	}

	function setSound(i: number, sound: number) {
		controller?.setPadSound(i, sound);
		controller?.save();
		activeInstrument.changed();
	}

	function finish() {
		onboardingFinished();
		void goto(next ?? `${base}/lessons`);
	}
</script>

<div class="wizard">
	<WizardRail {steps} {stepIndex} />

	{#if controller}
		{@const c = controller}
		{#if step === 'try'}
			<WizardCard title={isKeyboard ? 'Your keyboard is ready' : 'Your pads are ready'}>
				{#snippet subtitle()}
					{#if isKeyboard}
						Nothing to map — press <kbd>F</kbd> <kbd>G</kbd> <kbd>H</kbd> and the row above. Every
						key already plays a drum.
					{:else}
						Nothing to map — tap the pads. They are the same ones a lesson gives you.
					{/if}
				{/snippet}

				<div class="stage">
					<VirtualPads controller={c} keys={isKeyboard} onhit={hitGm} lit={litNotes} />
				</div>

				<p class="fine center" aria-live="polite">
					{#if lastDrum}
						That was the <strong>{lastDrum}</strong>.
					{:else}
						{isKeyboard ? 'Press a key to hear it.' : 'Tap a pad to hear it.'}
					{/if}
				</p>

				{#if isKeyboard}
					<p class="fine center">
						<kbd>Space</kbd> starts and resumes a lesson, <kbd>Esc</kbd> pauses and stops.
						{#if transportPressed}<span class="pressed">{transportPressed}</span>{/if}
					</p>
				{/if}

				{#snippet foot()}
					<button class="ghost" onclick={() => (step = 'sounds')}>Change the drums</button>
					<button class="primary" onclick={finish}>
						{next ? 'Back to the lesson →' : 'Start practising →'}
					</button>
				{/snippet}
			</WizardCard>
		{:else}
			<WizardCard title={isKeyboard ? 'Your keyboard pads' : 'Your on-screen pads'}>
				{#snippet subtitle()}
					Pick the drum each pad plays. The defaults cover everything the lessons use, so
					this is here if you want it, not because you need it.
				{/snippet}

				<div class="sound-grid">
					{#each c.pads as pad, i (pad.id)}
						<div class="sound-cell" class:hit={hitIndex === i}>
							<div class="sound-head">
								{#if isKeyboard && keyLabelFor(i)}
									<kbd class="key">{keyLabelFor(i)}</kbd>
								{:else}
									<span class="pad-num">{i + 1}</span>
								{/if}
								<button class="preview" onclick={() => hit(i)} title="Hear it">▶</button>
							</div>
							<select
								class="drum-select"
								value={pad.sound}
								onchange={(e) => setSound(i, Number(e.currentTarget.value))}
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
					<button class="ghost" onclick={() => (step = 'try')}>← Try it</button>
					<button class="primary" onclick={finish}>
						{next ? 'Back to the lesson →' : 'Start practising →'}
					</button>
				{/snippet}
			</WizardCard>
		{/if}
	{/if}
</div>

<style>
	.wizard {
		max-width: 560px;
		margin: 1.5rem auto 0;
	}

	.stage {
		padding: 1rem;
		border-radius: var(--radius);
		background: var(--surface-2);
		border: 1px solid var(--border);
	}

	.fine {
		margin: 0.75rem 0 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.center {
		text-align: center;
	}

	.pressed {
		display: block;
		color: var(--gold);
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}

	.sound-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.6rem;
	}

	.sound-cell {
		padding: 0.6rem;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		border: 1px solid var(--border);
		transition: border-color 120ms ease;
	}

	.sound-cell.hit {
		border-color: var(--gold);
	}

	.sound-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
		margin-bottom: 0.4rem;
	}

	.pad-num,
	.key {
		color: var(--text-faint);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.preview {
		padding: 0.15em 0.5em;
		font-size: 0.8rem;
	}

	.drum-select {
		width: 100%;
	}

	@media (max-width: 30rem) {
		.sound-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
