<!--
	The MIDI flow: connect, pick a port, describe the instrument's shape, map it,
	sort the pedals out, try it, bind the transport buttons.

	The body lives in $lib/setup so the fork at /onboarding stays a small screen
	whose only job is asking the question.
-->
<script lang="ts">
	import { page } from '$app/state';
	import MidiFlow from '$lib/setup/midi-flow.svelte';

	const next = $derived(page.url.searchParams.get('next'));
</script>

<MidiFlow {next} />
