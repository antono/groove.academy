<!--
  v0.4.0. The user-facing half of the changelog, written as prose — see
  CHANGELOG.md for the full split, internal work included.
-->
<script lang="ts">
	import { base } from '$app/paths';

	let { mastodon }: { mastodon: string } = $props();
</script>

<p>
	This one is about the instrument rather than the curriculum. A kit that maps itself
	correctly the first time, lessons that admit when they are asking for more hands than
	you have, and a way to start over without putting a stick down.
</p>

<h3>Your kit plays the drum you hear</h3>

<figure>
	<img
		src="{base}/news/2026-09-26-stay-on-the-kit/dp-2000.jpg"
		alt="A NUX DP-2000 percussion pad on a desk: eight square rubber pads in two rows of
		four, with a strip of knobs, a small screen and buttons running along the top edge. A
		pair of well-used drumsticks lies crossed over the pads."
		width="840"
		height="473"
	/>
	<figcaption>
		Eight pads, two rows of four — and the sticks happen to be lying along the two
		diagonals that now start a lesson and move you on.
	</figcaption>
</figure>

<p>
	Plug in a <strong>NUX DP-2000</strong> and it is recognised, drawn and mapped — kick,
	snare, both hi-hats, three toms and a ride, each pad playing the drum it plays on the
	module itself. Nothing to re-map afterwards.
</p>
<p>
	Getting there fixed something larger. Setup used to treat a pad's note as a statement
	about which drum it was, on the reasonable grounds that a drum module naming its own
	pads knows better than any list we could write. The DP-2000 is the counterexample:
	its pads send notes that sit squarely inside the General MIDI drum range and mean
	something else entirely. Pad five sends the note for "High Tom" and plays a kick. So
	every pad came out wrong — not slightly wrong, all eight of them — and the only way
	out was to correct each one by hand. A kit can now say that its notes carry no such
	meaning, and what it actually plays is believed instead.
</p>

<figure>
	<img
		src="{base}/news/2026-09-26-stay-on-the-kit/kit-mapped.png"
		alt="A lesson page showing the NUX DP-2000 drawn as two rows of four pads, with
		Kick, Snare and Closed HH lit along the front row, beside the lesson's chart of
		closed hats, snare and kick."
		width="840"
		height="620"
	/>
	<figcaption>
		The same eight pads as the photograph above, drawn by the app. The front row is lit
		because that is where this lesson's drums are — the picture is your instrument, not a
		generic kit.
	</figcaption>
</figure>

<h3>Lessons that need more hands than you have</h3>
<p>
	Twenty-seven of the ninety-two lessons put three hits on the same instant — a kick, a
	snare and a hat landing together. Two sticks and no pedal cannot play that. Until now
	those lessons opened anyway and quietly scored a third of every bar as misses you had
	no way to hit.
</p>
<p>
	They now say so before you start, on the card and on the lesson page, along with what
	would change the answer — usually a kick pedal, which frees the hand you were short
	of. They still open, and you can still try. The point is that the app should not let
	you discover it mid-bar.
</p>

<figure>
	<img
		src="{base}/news/2026-09-26-stay-on-the-kit/out-of-reach.png"
		alt="Three lesson cards. The first two are unmarked. The third, Triple Stack, carries
		a line reading: Needs 3 hits at once — a kick pedal would do it."
		width="840"
		height="620"
	/>
	<figcaption>
		Only the lesson that stacks three voices is marked. The two above it ask for two at a
		time, and say nothing.
	</figcaption>
</figure>

<h3>Start over without reaching for the screen</h3>
<p>
	A take goes wrong and you want it again from the top; it goes well and you want the
	next one. Both used to mean putting a stick down.
</p>
<p>
	Strike <strong>two opposite corners of your kit together</strong> and it happens.
	One diagonal starts a run, and restarts the lesson from the result screen. The other
	moves you on to the next lesson, and past the quote without rating it — skipping a
	quotation is not an opinion about it.
</p>
<p>
	While a lesson is actually playing, both are ignored. On a drum kit the corners are
	real drums, and kick-with-ride is something you play on purpose; a run is the one
	moment where a stray pair would cost you a good take. Sound and the controller still
	come up on your first click of a visit, as they always have — after that, the kit
	drives everything.
</p>

<h3>The chip knows your kit is plugged in</h3>
<p>
	The instrument in the top corner used to confirm a live connection only while you were
	inside a lesson or the setup wizard. Everywhere else it fell back to naming the kit
	without committing to whether it was really there. It now tells you on every page.
</p>

<p>
	That is the release. Questions, bugs and things that felt wrong are all welcome
	<a href={mastodon} rel="me">on Mastodon</a> — and the kit is waiting in
	<a href="{base}/lessons">the lessons</a>.
</p>
