<!--
  v0.3.0. The user-facing half of the changelog, written as prose — see
  CHANGELOG.md for the full split, internal work included.
-->
<script lang="ts">
	import { base } from '$app/paths';

	let { mastodon }: { mastodon: string } = $props();
</script>

<p>
	Until now every lesson here taught a mechanism — a limb, a subdivision, a hole in the bar.
	Useful, and not yet music. This release opens the <strong>Music tier</strong>: thirty new
	lessons where the thing being learned is a style. Rock, funk, hip-hop, house, breaks,
	reggae and drum &amp; bass, each at its own tempo, each over a bass line written for it.
	<strong>62 playable lessons become 92.</strong>
</p>

<h3>Three stages, and none of them are slots</h3>
<ul>
	<li>
		<strong>Form &amp; Fills</strong> — a groove that says something. The push is a
		down-beat moved early, and what you are really learning is the hole it leaves behind.
		Then the 16th fill in three escalations, and song form: the first
		<strong>eight-bar lessons</strong> in the app, with a beginning, a middle and an end.
	</li>
	<li>
		<strong>Styles: The Radio</strong> — rock, funk and hip-hop as one skeleton with three
		kick vocabularies. The snare never leaves 2 and 4. Only the kick and the tempo change,
		so what you hear changing is the genre and not your hands.
	</li>
	<li>
		<strong>Styles: The Dancefloor</strong> — here the skeleton itself changes. House takes
		the closed hat off the beat, breaks move the snare off the backbeat, and reggae's one
		drop leaves beat 1 empty on purpose. That last one closes a thread opened back in
		Foundations: Space taught you to play nothing and come back in exactly on time, and the
		one drop is a whole groove built out of that.
	</li>
</ul>

<figure>
	<img
		src="{base}/news/2026-09-14-play-a-style/music-tier.png"
		alt="The Music tier page, headed “Can you play something someone wants to hear?”, with
		three stage cards: 1 Form &amp; Fills, 2 Styles: The Radio, 3 Styles: The Dancefloor.
		Each carries a description, an Open link and a 0/10 cleared count."
	/>
	<figcaption>
		Last month this tier was three grey slots with numbers on them. Every lesson behind
		these cards is written.
	</figcaption>
</figure>

<figure>
	<img
		src="{base}/news/2026-09-14-play-a-style/one-drop.png"
		alt="The lesson “3.7 The One Drop”. Its pattern chart runs four bars: a Closed HH lane of
		unbroken hats across all of them, and a Snare lane and a Kick lane that each strike once
		per bar, together, halfway through it — the bar lines themselves are empty. Below are a
		Listen button, four practice hints and Play at 76 BPM. A chip at the top right of the
		page reads “Keyboard” with a green dot."
	/>
	<figcaption>
		Kick and snare land together in the middle of the bar and the bar line passes with
		nothing but a hat. The chip at the top right is new — it is telling you this is being
		played on a computer keyboard.
	</figcaption>
</figure>

<h3>A bass that sounds like a bass</h3>
<p>
	The backing was one synth patch playing every line at one volume. There are now two real
	electric basses under these lessons — a Yamaha RBX recorded fingerstyle and with a pick —
	and each line is played by whichever instrument suits it: the conversational lines on
	fingers, the quarter pulse and the boogie on the pick, the machine lines on the synths
	where a machine is the point.
</p>
<p>
	The lines also learned to phrase rather than march. The quarter line walks bar 4 home
	through G–B–D–E, the octave line runs a fifth into its turnaround, the syncopated line
	closes on an enclosure. You are practising against something that is playing, which is a
	different feeling from practising against something that is counting.
</p>

<h3>Setup asks what you play on</h3>
<p>
	It used to guess, from the name of your USB port, and it mostly guessed wrong — nearly
	every real electronic kit landed on a screen headed "Pad layout", with a text link below
	the fold as the way out. On an iPhone the whole thing opened on a Connect button that
	could not be pressed.
</p>
<p>
	Now the first screen is the question. Three answers — a MIDI controller, your computer
	keyboard, the pads on this screen — and none of them are greyed out; a browser that
	cannot do Web MIDI says what it needs instead of showing you a dead button. From there
	the flows are shorter and they end the same way: <strong
		>every one of them now proves your mapping before you practise on it</strong
	>. The on-screen pads never had a test step at all, and a pad grid's mapping was never
	checked until the first lesson went wrong.
</p>
<p>
	What your instrument looks like is a question inside the flow rather than a fork in the
	road: pick a kit schematic, an N × M grid, or a neutral arrangement. Your device may
	pre-select one, but it no longer decides for you, and a controller nobody recognises
	waits for your answer instead of being quietly called a grid.
</p>

<figure>
	<img
		src="{base}/news/2026-09-14-play-a-style/what-do-you-play-on.png"
		alt="A setup screen headed “What are you playing on?” with the line “Pick one and you will
		go straight back to your lesson.” Three cards follow, each with an arrow: “A MIDI drum kit
		or pad controller”, “My computer keyboard”, and “The screen I am on”. None of them is
		greyed out."
	/>
	<figcaption>
		Three answers, ordered by what this browser can actually do, and none of them disabled.
		Arriving here from a lesson means going back to that lesson when you are done.
	</figcaption>
</figure>

<h3>The header says what you are playing</h3>
<p>
	One chip, at the top of every page: the instrument you are on, whether it is actually
	plugged in, and a way to switch to another one you have set up or add a new one. The
	lesson page used to pick an input for you on the quiet, which is how someone could spend
	a session playing the on-screen pads while their kit sat there unnoticed. It does not do
	that any more — and setting up a second kit no longer steals your first one.
</p>
<p>
	If you open a lesson having set nothing up, the app takes you to the question and then
	brings you back to the lesson you asked for.
</p>

<h3>Restart, without leaving the highway</h3>
<p>
	Fumble the first bar and you had two choices: ride out the whole lesson, or stop and
	start again from the page before. The transport now carries Restart. The score is
	dropped, the count-in leads you back in on the click, and there is nothing to wait for —
	the sound is already up. Nothing is filed either way; a run only reaches your practice
	history by finishing.
</p>

<figure>
	<img
		src="{base}/news/2026-09-14-play-a-style/restart.png"
		alt="The transport across the top of the highway during a run: 76 BPM, then Compact,
		Pause, Restart and Stop. Below it the lanes scroll, with a row of hi-hats and a kick and
		a snare arriving at the playhead."
	/>
	<figcaption>Restart is the new one, and it never leaves the run.</figcaption>
</figure>

<h3>Also in this release</h3>
<ul>
	<li>
		<strong>Stats appears once you have some.</strong> An empty heatmap and four flat lines
		tell a new student nothing except that they are already behind. The link shows up the
		first time you finish a lesson.
	</li>
	<li>
		<strong>A Telegram channel and the source code</strong> are linked in the footer, beside
		Mastodon. The whole app is open — if you want to see how the scoring window works, it is
		right there.
	</li>
</ul>

<p>
	Follow <a href={mastodon} target="_blank" rel="noopener">@groove_academy</a> for the next
	one, or go <a href="{base}/lessons">play something</a> — preferably something with a
	reggae bass under it.
</p>
