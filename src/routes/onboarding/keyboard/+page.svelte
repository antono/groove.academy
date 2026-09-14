<script lang="ts">
	import { page } from '$app/state';
	import VirtualFlow from '$lib/setup/virtual-flow.svelte';
	import { VIRTUAL_KEYBOARD_ID } from '$lib/virtual-input';
	import PageMeta from '$lib/page-meta.svelte';

	const next = $derived(page.url.searchParams.get('next'));
</script>

<PageMeta
	title="Groove Academy — Set up your keyboard"
	description="Nothing to plug in and nothing to map: every pad already plays a drum."
/>

<VirtualFlow deviceId={VIRTUAL_KEYBOARD_ID} {next} />
