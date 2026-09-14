<!--
	The card every setup step is drawn inside: the panel, its heading and subtitle,
	and the footer rule that separates the controls from the content.

	Each step renders its own card rather than sharing one outer `<section>`, so a
	step that matches nothing renders nothing instead of an empty bordered panel.

	**Only the elements this component emits are styled here.** Svelte scopes CSS
	by where markup is *authored*, not where it is rendered, so everything passed
	in through `children`, `subtitle`, `badge` or `foot` keeps its styles on the
	page that wrote it. `.sub`'s colour and size still reach that content — by
	inheritance, which is scope-independent.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle,
		badge,
		align = 'start',
		foot,
		children
	}: {
		/** Every step's heading is a string or a string expression — never markup. */
		title: string;
		/**
		 * A snippet, not a string: most subtitles carry markup — a `<strong>`, the
		 * capture step's `<strong class="count">`, the keyboard step's `<kbd>` keys.
		 * Every step has one, so it is not optional.
		 */
		subtitle: Snippet;
		/** An adornment above the heading. Only the closing step uses one. */
		badge?: Snippet;
		align?: 'start' | 'center';
		/**
		 * The whole footer row, or omitted for a step that has no controls of its
		 * own. One slot rather than separate back/actions halves: `.card-foot` is
		 * already `space-between` and every footer has exactly two children, which
		 * is what lets the closing step put its button group first and its call to
		 * action last with no special case.
		 */
		foot?: Snippet;
		children: Snippet;
	} = $props();
</script>

<section class="card">
	<header class="card-head" class:center={align === 'center'}>
		{#if badge}{@render badge()}{/if}
		<h2>{title}</h2>
		<p class="sub">{@render subtitle()}</p>
	</header>

	{@render children()}

	{#if foot}
		<footer class="card-foot">{@render foot()}</footer>
	{/if}
</section>

<style>
	.card {
		padding: 1.75rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: calc(var(--radius) + 4px);
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
	}

	@media (max-width: 480px) {
		.card {
			padding: 1.25rem;
		}
	}

	.card-head {
		margin-bottom: 1.5rem;
	}

	/* Was `.done-head`, which named the one step that used it rather than what it did. */
	.card-head.center {
		text-align: center;
	}

	.sub {
		margin: 0.25rem 0 0;
		color: var(--text-muted);
		font-size: 0.95rem;
	}

	.card-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: 1.5rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border);
	}
</style>
