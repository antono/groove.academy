<!--
	The readable half of LICENSE. The repository file is the instrument that has
	legal effect — full CC0 text and all — and this page says the same thing in
	the words a person would use. If the two ever disagree, the file wins; keep
	them in step rather than letting this one drift.
-->
<script lang="ts">
	import { base } from '$app/paths';
	import PageMeta from '$lib/page-meta.svelte';

	const REPO_LICENSE = 'https://github.com/antono/groove.academy/blob/main/LICENSE';
	const REPO_THANKS = 'https://github.com/antono/groove.academy/blob/main/THANKS.md';
	const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
</script>

<PageMeta
	title="Licence — Groove Academy"
	description="Groove Academy is public domain under CC0 1.0. Use it however you like, with two exceptions that were never ours to give away."
/>

<h1>Licence</h1>

<p class="lede">
	Groove Academy is <strong>public domain</strong>. Use it however you like.
</p>

<p>
	Copy it, read it, take it apart, change it, teach with it, run your own copy, build
	something else out of it, sell that — commercially or not, with or without credit. You
	owe nothing and need ask no one. Formally this is a
	<a href={CC0} target="_blank" rel="noopener">CC0 1.0 Universal</a> dedication, and the
	<a href={REPO_LICENSE} target="_blank" rel="noopener">LICENSE file</a> carries its full
	text.
</p>

<p>
	That covers the project's own work: the code, the curriculum and the MIDI files behind
	it, the writing, the kit schematics and the artwork.
</p>

<h2>Two things are not ours to give away</h2>

<p>
	A dedication can only release rights the person making it actually holds. Two parts of
	Groove Academy were never ours, so they sit outside it.
</p>

<h3>The drum sounds</h3>
<p>
	Every drum you hear was rendered from a SoundFont that states no licence of its own.
	Rights that were never granted cannot be passed on, so the audio files under
	<code>static/drums/</code> are excluded. Everything that <em>makes</em> them is not: the
	renderer, the level table and the repair logic are all CC0, so anyone wanting a wholly
	unencumbered copy can re-render the drums from a SoundFont of their choosing.
</p>
<p>
	The bass is unaffected — those samples come from
	<a href="https://freepats.zenvoid.org/" target="_blank" rel="noopener">FreePats</a> and are
	already public domain.
</p>

<h3>The quotations</h3>
<p>
	The words between lessons belong to the drummers and producers who said them, and appear
	here attributed and sourced, as quotation. We cannot release someone else's sentences
	into the public domain. The choosing of them, the citations and the code around them are
	ours and are covered.
</p>

<h2>Why there is no copyright here</h2>

<p>
	Copyright was supposed to be a bargain: a short monopoly, granted by the public, in
	exchange for work that would shortly belong to the public. Fourteen years, once. It is
	now the life of the author plus seventy — longer than most careers, most companies and
	most of the technologies the work was made on. Nobody renegotiated that deal with you.
	It was simply extended, again and again, over the objections of almost everyone who
	makes things.
</p>

<p>
	And none of this is ours anyway. <strong>Nobody invented the backbeat.</strong> A kick
	on one and three, a snare on two and four — that is not an idea somebody owns, it is
	something the whole world has been doing for a century because it works. Every groove
	in this curriculum was played by someone else first, and by someone else before them.
	We arranged them into an order that teaches. Charging rent on that would be absurd.
</p>

<p>
	Teaching material you are not allowed to copy is a contradiction in terms. A lesson
	exists to be taken and used. If you learn a beat here, record it, teach it, put it in a
	track and sell the track — that is not a loophole, it is the entire point. There is no
	licence to comply with because <strong>there is no licence</strong>. We have not
	granted you permission; we have given the thing up.
</p>

<p class="sharp">
	And notice what the exceptions above actually are. The one part of this site we cannot
	hand you is the part somebody else locked — drum sounds whose licence was never
	written down, so nobody can say what may be done with them. That is the whole case
	against copyright, sitting in one directory: not a creator protected, just a sound
	nobody can lawfully pass on, because thirty years ago someone forgot to say it was
	free.
</p>

<p>
	So: no permissions to request, no attribution to remember, no terms to accept, nothing
	to breach. Take it. Fork it. Strip our name off it. Teach a thousand people from it and
	tell them you wrote it. We would rather it spread than that it stayed ours.
</p>

<p>
	Sources and credits for every sample are listed in
	<a href={REPO_THANKS} target="_blank" rel="noopener">THANKS.md</a>. Third-party
	dependencies carry their own licences, as always.
</p>

<p class="back"><a href="{base}/lessons">← Back to the lessons</a></p>

<style>
	.lede {
		font-size: 1.15rem;
	}
	h2 {
		margin-top: 2.5rem;
	}
	h3 {
		margin-top: 1.75rem;
	}
	code {
		font-size: 0.9em;
	}
	.sharp {
		border-inline-start: 3px solid var(--gold, currentColor);
		padding-inline-start: 1rem;
	}
	.back {
		margin-top: 2.5rem;
	}
</style>
