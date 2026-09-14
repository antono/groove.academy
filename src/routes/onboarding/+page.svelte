<!--
	The question the wizard exists to answer, asked instead of guessed.

	What it deliberately does NOT do: call `requestMIDIAccess()`. The probe below is
	synchronous, because a permission prompt can stay pending indefinitely and this
	screen must not be waiting on one. Detection never picks a flow either — it only
	orders these three cards, and a card that cannot work here is still selectable,
	just moved down and labelled. A disabled primary action never leads this page,
	which is what it used to do on every iPhone.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import PageMeta from '$lib/page-meta.svelte';
	import { onboardingStarted } from '$lib/analytics';
	import { activeInstrument } from '$lib/active-instrument.svelte';

	/**
	 * Synchronous capability probe. `typeof` on the method and a media query — no
	 * access request, no await, nothing that can hang.
	 */
	let hasWebMidi = $state(true);
	let coarse = $state(false);

	onMount(() => {
		onboardingStarted();
		hasWebMidi = typeof navigator.requestMIDIAccess === 'function';
		coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
	});

	/**
	 * Where to send the student back to once a flow finishes, if they were gated
	 * here. Treated as untrusted: it arrives in the URL, so anything that is not a
	 * plain in-app path is dropped in favour of the ordinary destination. `//host`
	 * is a protocol-relative URL, which is why a leading slash alone is not enough.
	 */
	const next = $derived.by(() => {
		const raw = page.url.searchParams.get('next');
		if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
		return raw;
	});
	const q = $derived(next ? `?next=${encodeURIComponent(next)}` : '');

	type Card = {
		id: string;
		href: string;
		title: string;
		blurb: string;
		icon: string;
		/** Shown when this choice cannot work on this device. Never hides the card. */
		caveat?: string;
	};

	const cards = $derived.by<Card[]>(() => {
		const keyboard: Card = {
			id: 'keyboard',
			href: `${base}/onboarding/keyboard${q}`,
			title: 'My computer keyboard',
			blurb: 'Six keys under your fingers. Nothing to plug in, nothing to map.',
			icon: '⌨️',
			caveat: coarse ? 'Needs a keyboard attached to this device.' : undefined
		};
		const touch: Card = {
			id: 'touch',
			href: `${base}/onboarding/touch${q}`,
			title: 'The screen I am on',
			blurb: 'Six pads you tap. Works on a phone or tablet with nothing attached.',
			icon: '👆',
			caveat: coarse ? undefined : 'Best on a touchscreen — a mouse works, but one pad at a time.'
		};
		const midi: Card = {
			id: 'midi',
			href: `${base}/onboarding/midi${q}`,
			title: 'A MIDI drum kit or pad controller',
			blurb: 'An electronic kit, a drum module, or a grid of pads. We learn its layout.',
			icon: '🥁',
			caveat: hasWebMidi ? undefined : 'Needs Chrome, Edge or Opera on desktop or Android.'
		};

		// Capability orders the cards; it never removes one. A student who connects a
		// controller after landing on a phone still needs to find the MIDI card.
		if (!hasWebMidi) return coarse ? [touch, keyboard, midi] : [keyboard, touch, midi];
		if (coarse) return [touch, midi, keyboard];
		return [midi, keyboard, touch];
	});
</script>

<PageMeta
	title="Groove Academy — What are you playing on?"
	description="Set up your instrument: a computer keyboard, the screen you are on, or a MIDI drum kit. Takes one click for two of them."
/>

<div class="fork">
	<header class="fork-head">
		<h1>What are you playing on?</h1>
		<p class="sub">
			{#if next}
				Pick one and you will go straight back to your lesson.
			{:else}
				Pick the one you have. You can change it later, or set up more than one.
			{/if}
		</p>
	</header>

	<ul class="cards">
		{#each cards as card, i (card.id)}
			<li>
				<a class="card" class:lead={i === 0} href={card.href}>
					<span class="icon" aria-hidden="true">{card.icon}</span>
					<span class="text">
						<span class="title">{card.title}</span>
						<span class="blurb">{card.blurb}</span>
						{#if card.caveat}<span class="caveat">{card.caveat}</span>{/if}
					</span>
					<span class="go" aria-hidden="true">→</span>
				</a>
			</li>
		{/each}
	</ul>

	{#if activeInstrument.anyConfigured}
		<p class="fine">
			Already set up something? <a href="{base}/lessons">Go and practise</a>.
		</p>
	{/if}
</div>

<style>
	.fork {
		max-width: 560px;
		margin: 1.5rem auto 0;
	}

	.fork-head {
		margin-bottom: 1.5rem;
	}

	h1 {
		margin: 0;
		font-size: 1.6rem;
	}

	.sub {
		margin: 0.35rem 0 0;
		color: var(--text-muted);
		font-size: 0.95rem;
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.1rem 1.25rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
		text-decoration: none;
		transition:
			border-color 140ms ease,
			background 140ms ease;
	}

	/* The one that fits this device. Emphasis, not exclusivity. */
	.card.lead {
		border-color: var(--gold);
		background: var(--surface-2);
	}

	.card:hover,
	.card:focus-visible {
		border-color: var(--gold);
	}

	.icon {
		font-size: 1.6rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
		flex: 1;
	}

	.title {
		font-weight: 650;
	}

	.blurb {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.caveat {
		color: var(--text-faint);
		font-size: 0.8rem;
	}

	.go {
		color: var(--text-faint);
		flex-shrink: 0;
	}

	.fine {
		margin: 1.25rem 0 0;
		text-align: center;
		color: var(--text-faint);
		font-size: 0.85rem;
	}

	@media (max-width: 480px) {
		.card {
			padding: 1rem;
		}
	}
</style>
