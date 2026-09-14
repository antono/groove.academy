<!--
	The setup wizard's progress rail.

	It renders whichever flow is active, so the number of dots always matches the
	number of screens the student will actually walk — which is the whole point of
	it, and the reason it takes `steps` rather than reading any global state.

	`id` is typed as a bare string, not the wizard's Step union: the rail does not
	care what the steps are, and keeping it loose lets the three flow routes pass
	their own step lists without a shared union to agree on.
-->
<script lang="ts">
	/**
	 * Past this many steps the labels stop fitting side by side, so the dots carry
	 * the count and only the step you are on is named. It lives here, once,
	 * because it is a fact about how wide a label is — not about any one flow.
	 * A flow that adds a step crosses it without anyone editing a comment.
	 */
	const MAX_LABELLED = 5;

	let {
		steps,
		stepIndex
	}: { steps: { id: string; label: string }[]; stepIndex: number } = $props();

	const long = $derived(steps.length > MAX_LABELLED);
</script>

<!--
	`role`/`aria-current` are explicit on purpose. `list-style: none` strips the
	list role in Chrome, so an <ol> alone reaches a screen reader as loose text
	with no structure and no indication of where the student is.
-->
<ol class="rail" class:long role="list" aria-label="Setup progress">
	{#each steps as s, i (s.id)}
		<li
			class="rail-step"
			class:active={i === stepIndex}
			class:done={i < stepIndex}
			role="listitem"
			aria-current={i === stepIndex ? 'step' : undefined}
		>
			<span class="rail-dot">{i < stepIndex ? '✓' : i + 1}</span>
			<span class="rail-label">{s.label}</span>
			{#if i < steps.length - 1}<span class="rail-line"></span>{/if}
		</li>
	{/each}
</ol>

<style>
	.rail {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		list-style: none;
		margin: 0 0 1.5rem;
		padding: 0 0.25rem;
	}

	/*
		`flex: 1 1 auto`, not `flex: 1`. With a zero basis every step gets an equal
		share of the rail, so "Map pads" was truncated while "Grid" sat in slack —
		even at widths where the labels collectively fit with room to spare. Sizing
		from content and sharing only the surplus lets each label keep its own
		width, and the connecting lines still absorb what is left over.
	*/
	.rail-step {
		display: flex;
		flex: 1 1 auto;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.rail-step:last-child {
		flex: 0 0 auto;
	}

	.rail-dot {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		flex-shrink: 0;
		border-radius: 50%;
		border: 2px solid var(--border-strong);
		color: var(--text-faint);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		transition:
			border-color 200ms ease,
			background 200ms ease,
			color 200ms ease;
	}

	.rail-step.active .rail-dot {
		border-color: var(--gold);
		color: var(--gold);
		box-shadow: 0 0 10px var(--gold-dim);
	}

	.rail-step.done .rail-dot {
		border-color: var(--green);
		background: var(--green);
		color: #0e2018;
	}

	/*
		Truncates rather than collides. A label is nowrap, so without `min-width: 0`
		a flex item refuses to shrink below its text and simply overlaps the next
		step's dot — which is what it did between the label breakpoint and roughly
		560px. Same pattern as `.device-name`.
	*/
	.rail-label {
		font-size: 0.85rem;
		color: var(--text-faint);
		white-space: nowrap;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rail-step.active .rail-label {
		color: var(--text);
		font-weight: 600;
	}

	.rail-step.done .rail-label {
		color: var(--text-muted);
	}

	.rail-line {
		flex: 1;
		height: 1px;
		min-width: 0.75rem;
		background: var(--border);
	}

	.rail.long .rail-step:not(.active) .rail-label {
		display: none;
	}

	/*
		"More steps than fit" is a question about width, not only about how many
		steps there are. A five-step rail fits its labels on a desktop and does not
		in a narrow window, so the same collapse applies there — otherwise the
		labels survive as ellipsised stubs ("Conn…", "Devi…"), which satisfies
		not-overlapping while telling the student nothing.

		Above this the widest flow's labels are measured to fit; below it only the
		step you are on is named, exactly as a long flow behaves.
	*/
	@media (max-width: 640px) {
		.rail .rail-step:not(.active) .rail-label {
			display: none;
		}
	}

	/*
		Below this the labels do not fit at all and the dots carry the whole story.
		An overlap check down here is vacuous — there is nothing drawn to overlap —
		so what matters at phone width is that the dots and lines still fit.
	*/
	@media (max-width: 480px) {
		.rail-label {
			display: none;
		}
	}
</style>
