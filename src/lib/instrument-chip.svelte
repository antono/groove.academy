<!--
	The header's standing answer to "what am I playing on right now".

	**It never requests MIDI access.** The chip renders on every page including the
	fork, which must not raise a permission prompt, so presence is only ever read
	from an access object some other surface already holds. With none held it says
	"configured" and claims nothing about the cable — three states, not two, and
	"unknown" is the common case on a first visit rather than a failure.
-->
<script lang="ts">
	import { base } from '$app/paths';
	import { activeInstrument } from '$lib/active-instrument.svelte';
	import { isVirtualId } from '$lib/virtual-input';

	let open = $state(false);
	let root = $state<HTMLElement | null>(null);

	const active = $derived(activeInstrument.summary);
	const all = $derived(activeInstrument.all);

	type Presence = 'present' | 'absent' | 'unknown';

	function presenceOf(deviceId: string): Presence {
		if (isVirtualId(deviceId)) return 'present'; // needs no access, cannot be unplugged
		const ports = activeInstrument.ports;
		if (!ports) return 'unknown';
		return ports.includes(deviceId) ? 'present' : 'absent';
	}

	const presence = $derived<Presence>(active ? presenceOf(active.deviceId) : 'unknown');

	const stateLabel = $derived(
		presence === 'present' ? 'connected' : presence === 'absent' ? 'not connected' : 'configured'
	);

	function choose(deviceId: string) {
		// Never underneath a scored run: the run is being scored against this
		// instrument's mapping, and swapping it mid-run invalidates what it measured.
		if (activeInstrument.runInProgress) return;
		activeInstrument.set(deviceId);
		open = false;
	}

	function onWindowClick(e: MouseEvent) {
		if (!open || !root) return;
		if (!root.contains(e.target as Node)) open = false;
	}
</script>

<svelte:window
	onclick={onWindowClick}
	onkeydown={(e) => {
		if (e.key === 'Escape') open = false;
	}}
/>

{#if active}
	<div class="chip-root" bind:this={root}>
		<button
			class="chip"
			class:present={presence === 'present'}
			class:absent={presence === 'absent'}
			aria-expanded={open}
			aria-haspopup="menu"
			onclick={() => (open = !open)}
			title="{active.name} — {stateLabel}"
		>
			<span class="dot" aria-hidden="true"></span>
			<span class="chip-name">{active.name}</span>
			<span class="sr-only">— {stateLabel}. Change instrument</span>
		</button>

		{#if open}
			<div class="menu" role="menu">
				{#each all as s (s.deviceId)}
					{@const p = presenceOf(s.deviceId)}
					<button
						role="menuitemradio"
						aria-checked={s.deviceId === active.deviceId}
						class:current={s.deviceId === active.deviceId}
						disabled={activeInstrument.runInProgress}
						onclick={() => choose(s.deviceId)}
					>
						<span class="dot" class:present={p === 'present'} class:absent={p === 'absent'}
						></span>
						<span class="menu-name">{s.name}</span>
						<span class="menu-state">
							{p === 'present' ? 'connected' : p === 'absent' ? 'not connected' : 'configured'}
						</span>
					</button>
				{/each}
				{#if activeInstrument.runInProgress}
					<p class="fine">Finish the run before switching.</p>
				{/if}
				<a class="add" href="{base}/onboarding" onclick={() => (open = false)}>Set up another…</a>
			</div>
		{/if}
	</div>
{/if}

<style>
	.chip-root {
		position: relative;
		display: flex;
	}

	.chip {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.75rem;
		padding: 0.3rem 0.6rem;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		font-size: 0.85rem;
		max-width: 12rem;
	}

	.chip-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		flex-shrink: 0;
		border-radius: 50%;
		border: 1px solid var(--text-faint);
		background: transparent;
	}

	.chip.present .dot,
	.dot.present {
		border-color: var(--green);
		background: var(--green);
	}

	.chip.absent .dot,
	.dot.absent {
		border-color: var(--text-faint);
		background: transparent;
	}

	.menu {
		position: absolute;
		top: calc(100% + 0.4rem);
		right: 0;
		z-index: 40;
		min-width: 14rem;
		padding: 0.35rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
	}

	.menu button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		min-height: 2.75rem;
		padding: 0.4rem 0.5rem;
		background: transparent;
		border: 0;
		border-radius: var(--radius-sm);
		color: var(--text);
		font-size: 0.9rem;
		text-align: left;
	}

	.menu button.current {
		background: var(--surface-2);
	}

	.menu-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.menu-state {
		color: var(--text-faint);
		font-size: 0.75rem;
	}

	.add {
		display: block;
		min-height: 2.75rem;
		padding: 0.7rem 0.5rem;
		margin-top: 0.25rem;
		border-top: 1px solid var(--border);
		color: var(--text-muted);
		font-size: 0.85rem;
		text-decoration: none;
	}

	.fine {
		margin: 0.25rem 0.5rem;
		color: var(--text-faint);
		font-size: 0.75rem;
	}

	/*
		At phone width the wordmark and the menu control already fill the row, so the
		chip keeps only its state dot. The name stays in the accessible name and the
		title, so nothing is lost to a screen reader.
	*/
	@media (max-width: 48rem) {
		.chip {
			/*
				Square, dot only. `max-width: none` let it flex to a quarter of the
				viewport while showing nothing but a dot; the budget at 320px is the
				wordmark plus a 44px menu control plus this, so it has to be a target,
				not a strip.
			*/
			flex: 0 0 auto;
			width: 2.75rem;
			max-width: 2.75rem;
			justify-content: center;
			padding: 0.3rem;
		}
		.chip-name {
			display: none;
		}
	}
</style>
