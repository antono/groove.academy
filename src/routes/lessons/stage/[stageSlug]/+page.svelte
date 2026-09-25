<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { parseMidi } from '$lib/midi';
	import LessonChart from '$lib/lesson-chart.svelte';
	import PageMeta from '$lib/page-meta.svelte';
	import Breadcrumbs from '$lib/breadcrumbs.svelte';
	import { allSessions } from '$lib/stats';
	import { Controller } from '$lib/controller.svelte';
	import { activeInstrument } from '$lib/active-instrument.svelte';
	import { progressByLesson, type LessonProgress } from '$lib/progress';
	import type { Lesson, Slot } from '$lib/catalogue';
	import type { PageData } from './$types';

	// One stage: its modules and their lesson cards, plus the closing checkpoint.
	// The cards are exactly as the catalogue always drew them — schematic read
	// from the lesson's own MIDI, summary, and earned/tempo badges — only now
	// grouped under one stage rather than the whole scrolling curriculum.
	let { data }: { data: PageData } = $props();

	// What the schematic needs, derived from each lesson's MIDI.
	type Preview = {
		lanes: number[];
		notes: { beat: number; note: number }[];
		lengthBeats: number;
	};

	let previews = $state(new Map<string, Preview>());
	let progress = $state(new Map<string, LessonProgress>());
	let drumNames = $state(new Map<number, string>());

	/**
	 * How many hits the active instrument can land at once, or null when there is
	 * none configured. A lesson asking for more is marked — not disabled: the
	 * student may put down a stick, or simply want to try.
	 */
	let reach = $state<number | null>(null);
	let reachIsStickKit = $state(false);

	const stage = $derived(data.stage);
	const tier = $derived(data.tier);
	const lessons = $derived(new Map<string, Lesson>((data.manifest?.lessons ?? []).map((l) => [l.id, l])));

	// Every slot id in this stage, so the preview load stays scoped to the stage.
	const stageLessonIds = $derived(
		new Set([
			...stage.modules.flatMap((m) => m.lessons.map((s) => s.id)),
			...(stage.closing ? [stage.closing.id] : [])
		])
	);

	const laneName = (n: number) => drumNames.get(n) ?? String(n);

	// The catalogue reads the same MIDI the highway plays, so a chart can never
	// drift from the lesson it previews.
	async function loadPreview(lesson: Lesson): Promise<Preview | null> {
		try {
			const res = await fetch(`${base}/lessons/${lesson.file}`);
			const midi = parseMidi(await res.arrayBuffer());
			return {
				lanes: [...new Set(midi.notes.map((n) => n.note))].sort((a, b) => b - a),
				notes: midi.notes,
				lengthBeats: midi.lengthBeats
			};
		} catch {
			return null;
		}
	}

	onMount(async () => {
		// The active instrument decides which lessons are out of reach. Best-effort
		// like the rest of this page: no instrument, or storage refused, means
		// nothing is marked, which is the permissive answer.
		try {
			const id = activeInstrument.id;
			const c = id ? Controller.load(id) : null;
			if (c) {
				reach = c.voices;
				reachIsStickKit = c.kind === 'edrum' && !c.pads.some((p) => p.pedal === 'kick');
			}
		} catch {
			// leave reach null — mark nothing
		}
		// History is decoration on the cards, so it is started but never awaited —
		// storage can be refused or busy and the cards must still appear.
		void allSessions().then((runs) => {
			progress = progressByLesson(runs);
		});
		try {
			const drums = (await (await fetch(`${base}/drums/manifest.json`)).json()).drums ?? [];
			drumNames = new Map(drums.map((d: { note: number; name: string }) => [d.note, d.name]));
		} catch {
			// Charts fall back to numeric lane labels; no reason to fail the page.
		}
		// Only the written lessons in this stage have MIDI to preview.
		const written = (data.manifest?.lessons ?? []).filter((l) => lessons.has(l.id) && stageLessonIds.has(l.id));
		const entries = await Promise.all(written.map(async (l) => [l.id, await loadPreview(l)] as const));
		previews = new Map(entries.filter((e): e is [string, Preview] => e[1] !== null));
	});
</script>

{#snippet card(slot: Slot)}
	{@const lesson = lessons.get(slot.id)}
	{@const preview = previews.get(slot.id)}
	{@const earned = progress.get(slot.id)}
	<!-- The manifest BPM is the ladder's bottom rung, so it is also the floor for
	     anything the history claims. -->
	{@const topBpm = Math.max(lesson?.bpm ?? 0, earned?.maxBpm ?? 0)}
	{@const beyond =
		lesson && reach != null && (lesson.voices ?? 0) > reach ? (lesson.voices ?? 0) : 0}
	<li class="card" class:planned={!lesson}>
		<div class="card-head">
			<span class="number">{slot.number}</span>
			<h3>
				{#if lesson}
					<a class="stretch" href="{base}/lessons/{slot.id}">{slot.name}</a>
				{:else}
					{slot.name}
				{/if}
			</h3>
			<span class="tier {slot.tier}">{slot.tier}</span>
		</div>

		{#if lesson}
			<p class="summary">{lesson.summary ?? lesson.description ?? ''}</p>
			{#if preview}
				<div class="chart-frame">
					<LessonChart
						notes={preview.notes}
						lanes={preview.lanes}
						lengthBeats={preview.lengthBeats}
						{laneName}
					/>
				</div>
			{:else}
				<p class="warn">Could not read {lesson.file}</p>
			{/if}
			{#if beyond}
				<p class="beyond">
					<span aria-hidden="true">!</span>
					Needs {beyond} hits at once{#if reachIsStickKit}&nbsp;— a kick pedal would do it{/if}
				</p>
			{/if}
			<div class="card-foot">
				<!-- The whole card is the link (see .stretch), so this is an affordance
					     rather than a second link to the same lesson. -->
					<span class="cta">Practice →</span>
				<div class="earned">
					{#if earned?.cleared}
						<span class="cleared" title="Runs finished without skipping a note"
							>✓ {earned.cleared}</span
						>
					{/if}
					<span
						class="tempo"
						class:unlocked={topBpm > lesson.bpm}
						title={topBpm > lesson.bpm
							? `Unlocked up to ${topBpm} BPM — starts at ${lesson.bpm}`
							: 'Starting tempo'}>{topBpm} BPM</span
					>
				</div>
			</div>
		{:else}
			<p class="summary">Not written yet.</p>
		{/if}
	</li>
{/snippet}

<PageMeta title="Groove Academy — Stage {stage.tierNumber} · {stage.title}" description={stage.goal} />

<Breadcrumbs
	crumbs={[
		{ label: 'Lessons', href: `${base}/lessons` },
		...(tier ? [{ label: tier.name, href: `${base}/lessons/tier/${tier.slug}` }] : []),
		{ label: `Stage ${stage.tierNumber} · ${stage.title}` }
	]}
/>

<h1><span class="stage-num">Stage {stage.tierNumber}</span>{stage.title}</h1>
<p class="goal">{stage.goal}</p>

{#each stage.modules as mod (mod.slug)}
	<h2 class="module">{mod.title}<span class="subtitle">{mod.subtitle}</span></h2>
	<ul class="grid">
		{#each mod.lessons as slot (slot.id)}
			{@render card(slot)}
		{/each}
	</ul>
{/each}

{#if stage.closing}
	<h2 class="module checkpoint">
		Checkpoint<span class="subtitle">
			a bar of each — switching between patterns is what makes them stick
		</span>
	</h2>
	<ul class="grid">
		{@render card(stage.closing)}
	</ul>
{/if}

<style>
	.stage-num {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--gold);
	}

	.goal {
		max-width: 46rem;
		margin: 0.35rem 0 2rem;
		color: var(--text-muted);
		font-size: 1.05rem;
	}

	.warn {
		color: var(--gold);
		font-size: 0.9rem;
	}

	.module {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin: 0 0 0.75rem;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--border);
		font-size: 1.02rem;
	}

	.module .subtitle {
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 400;
	}

	.grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr));
		margin: 0 0 2rem;
		padding: 0;
		list-style: none;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		/* Positioning context for the title link's stretched overlay. */
		position: relative;
		padding: 1.1rem 1.25rem 1.25rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.card:has(.stretch:hover),
	.card:has(.stretch:focus-visible) {
		border-color: var(--border-strong);
	}

	/* A slot that is designed but not written. Present so the shape of the module
	   is visible, dimmed so it is never mistaken for something playable. */
	.card.planned {
		border-style: dashed;
		background: none;
		opacity: 0.55;
	}

	.card-head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.card-head .number {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.card h3 {
		margin: 0;
		font-size: 1rem;
		flex: 1;
	}

	.card h3 a {
		color: var(--text);
		text-decoration: none;
	}

	.card h3 a:hover {
		color: var(--gold);
	}

	/* Where the lesson sits inside its module — the one thing that says how hard
	   it is relative to its neighbours. */
	.tier {
		padding: 0.15em 0.5em;
		border: 1px solid var(--border);
		border-radius: 999px;
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.tier.core {
		color: var(--cyan);
		border-color: color-mix(in srgb, var(--cyan) 45%, transparent);
	}

	.tier.stretch,
	.tier.checkpoint {
		color: var(--gold);
		border-color: color-mix(in srgb, var(--gold) 45%, transparent);
	}

	.summary {
		margin: 0;
		font-size: 0.92rem;
		line-height: 1.55;
		color: var(--text-muted);
	}

	.chart-frame {
		padding: 0.5rem 0.6rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}

	.card-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: auto;
	}

	.cta {
		padding: 0.5em 1.1em;
		border-radius: var(--radius-sm);
		background: var(--gold);
		border: 1px solid var(--gold);
		color: #1a1505;
		font-weight: 650;
		font-size: 0.92rem;
		text-decoration: none;
	}

	/* The CTA is no longer a link, so it lights from the card's hover rather than
	   its own — the whole card is the thing being hovered. */
	.card:has(.stretch:hover) .cta {
		background: #f6cd5e;
	}

	/* What the student has to show for this lesson, opposite the way back into it.
	   The badges carry title attributes worth hovering, so they sit above the
	   stretched overlay that would otherwise intercept the pointer. */
	.earned {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		position: relative;
		z-index: 2;
	}

	.cleared {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--cyan);
	}

	.tempo {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	/* A tempo above the lesson's base was earned rung by rung — worth reading as
	   progress rather than as the number the lesson shipped with. */
	.tempo.unlocked {
		color: var(--gold);
	}

	.beyond {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		margin: 0.35rem 0 0;
		font-size: 0.82em;
		line-height: 1.35;
		color: var(--muted, inherit);
	}
	.beyond span {
		flex: none;
		display: inline-grid;
		place-items: center;
		inline-size: 1.1em;
		block-size: 1.1em;
		border: 1px solid currentColor;
		border-radius: 50%;
		font-size: 0.85em;
		font-weight: 700;
	}
</style>
