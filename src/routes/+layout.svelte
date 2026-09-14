<script lang="ts">
	import InstrumentChip from '$lib/instrument-chip.svelte';
	import '../app.css';
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import { base } from '$app/paths';
	import { page } from '$app/state';

	import { savedKit } from '$lib/config';
	import { warmKit } from '$lib/drums';
	import { initPwa } from '$lib/pwa.svelte';
	import InstallStrip from '$lib/install-strip.svelte';
	import { authState } from '$lib/auth.svelte';
	import { startSync, queueReconcile } from '$lib/sync';
	import {
		OG_IMAGE,
		OG_IMAGE_ALT,
		OG_IMAGE_HEIGHT,
		OG_IMAGE_WIDTH,
		SITE_NAME
	} from '$lib/site';

	let { children, data } = $props();

	// Mirror the layout's resolved auth into the shared store on every load
	// (including after invalidate('supabase:auth')), so UI stays in step.
	$effect(() => {
		authState.user = data.user;
		authState.session = data.session;
		authState.ready = true;
	});

	// Start background sync and keep the client session in step with the server.
	onMount(() => {
		const supabase = data.supabase;
		if (!supabase) return;
		startSync(supabase);
		const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
			authState.session = newSession;
			authState.user = newSession?.user ?? null;
			// A changed session means the server load must re-run to match.
			if (newSession?.expires_at !== data.session?.expires_at) {
				void invalidate('supabase:auth');
			}
			queueReconcile();
		});
		return () => sub.subscription.unsubscribe();
	});

	const MASTODON = 'https://mastodon.social/@groove_academy';
	const TELEGRAM = 'https://t.me/the_groove_academy';
	const GITHUB = 'https://github.com/antono/groove.academy';

	// Pull the current kit's samples into the service-worker cache while the page
	// is idle, so the first pad press is never waiting on a download. After the
	// first visit these are all cache hits, so it costs nothing to repeat.
	onMount(() => {
		const warm = () => warmKit(savedKit());
		if (typeof requestIdleCallback === 'function') {
			const handle = requestIdleCallback(warm, { timeout: 3000 });
			return () => cancelIdleCallback(handle);
		}
		const timer = setTimeout(warm, 1500);
		return () => clearTimeout(timer);
	});

	// Install detection: holds the browser's deferred prompt for the strip below,
	// and warms the offline set once the app is actually installed.
	onMount(() => initPwa());

	// Debug pages are only linked for people who opted in with
	// `localStorage.debug = 1` in the console; the routes stay reachable by URL.
	let showDebug = $state(false);
	onMount(() => {
		try {
			showDebug = Boolean(localStorage.getItem('debug'));
		} catch {
			// No storage (private mode) — stay hidden.
		}
	});

	const links = $derived([
		{ href: `${base}/`, route: '/', label: 'About', exact: true },
		{ href: `${base}/lessons`, route: '/lessons', label: 'Lessons' },
		{ href: `${base}/stats`, route: '/stats', label: 'Stats' },
		{ href: `${base}/onboarding`, route: '/onboarding', label: 'Setup' },
		{ href: `${base}/news`, route: '/news', label: 'News' },
		{ href: `${base}/account`, route: '/account', label: 'Account' },
		...(showDebug ? [{ href: `${base}/debug`, route: '/debug', label: 'Debug' }] : [])
	]);

	// base is relative during SSR ("./…"), so match on the route id instead.
	// The About link points at "/", which would prefix-match everything, so it
	// only lights up on an exact match.
	const active = (link: { route: string; exact?: boolean }) =>
		link.exact ? page.route.id === link.route : (page.route.id?.startsWith(link.route) ?? false);

	// ---- collapsed navigation ------------------------------------------------
	//
	// Below MOBILE_BREAKPOINT the links fold into a full-screen panel. It is a
	// panel rather than a dropdown because the links are then at reading size and
	// full tap size, which is the whole point of collapsing them.

	let menuOpen = $state(false);
	let menuButton: HTMLButtonElement | null = $state(null);
	let panel: HTMLElement | null = $state(null);

	// Close on navigation. Reading page.url is what subscribes this effect, so a
	// link inside the panel closes it without every link needing an onclick.
	$effect(() => {
		page.url.pathname;
		menuOpen = false;
	});

	// Move focus into the panel when it opens, so the next Tab lands inside it
	// rather than continuing down the page behind.
	$effect(() => {
		if (menuOpen) panel?.querySelector('a')?.focus();
	});

	// The page behind must not scroll while the panel covers it — on iOS that
	// shows as the panel sliding over a page that is quietly moving underneath.
	$effect(() => {
		if (!menuOpen) return;
		const { overflow } = document.body.style;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = overflow;
		};
	});

	function closeMenu() {
		menuOpen = false;
		menuButton?.focus();
	}

	// Escape closes; Tab wraps. Confining focus by hand rather than with inert on
	// the rest of the document: the panel is a sibling of the whole app, and the
	// set of focusable things inside it is just its links and its close button.
	function onPanelKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeMenu();
			return;
		}
		if (event.key !== 'Tab' || !panel) return;
		const focusable = panel.querySelectorAll<HTMLElement>('a[href], button');
		if (focusable.length === 0) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} type="image/svg+xml" />
	<!-- Raster fallbacks for the two places an SVG icon isn't picked up: older
	     browsers, and the iOS home screen. Both are rendered from the same file. -->
	<link rel="alternate icon" href="{base}/favicon-32.png" sizes="32x32" />
	<link rel="apple-touch-icon" href="{base}/apple-touch-icon.png" />

	<!-- Installability. One colour scheme, so the theme colour is a constant —
	     it tints the system UI around the installed app and the address bar. -->
	<link rel="manifest" href="{base}/manifest.webmanifest" />
	<meta name="theme-color" content="#0e0f17" />

	<!-- The half of the link preview that is the same on every route. The title,
	     description and URL are per-page and come from $lib/page-meta.svelte —
	     emitting them here too would leave two og:title tags in the head, and
	     crawlers keep whichever they meet first. -->
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="en_GB" />
	<meta property="og:image" content={OG_IMAGE} />
	<meta property="og:image:width" content={String(OG_IMAGE_WIDTH)} />
	<meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)} />
	<meta property="og:image:alt" content={OG_IMAGE_ALT} />
	<!-- Without this Twitter and Slack fall back to a thumbnail-sized card that
	     crops the 1.91:1 image down to a square. -->
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="app">
	<header class="header">
		<a class="brand" href="{base}/">
			<img class="brand-mark" src={favicon} alt="" width="512" height="512" />
			<span class="brand-name">Groove Academy</span>
		</a>
		<nav class="nav">
			{#each links as link (link.href)}
				<a href={link.href} class:active={active(link)}>{link.label}</a>
			{/each}
		</nav>

		<div class="header-end">
			<InstrumentChip />
			<button
				class="menu-button"
				bind:this={menuButton}
				aria-expanded={menuOpen}
				aria-controls="nav-panel"
				onclick={() => (menuOpen = true)}
			>
				<span class="bars" aria-hidden="true"></span>
				<span class="sr-only">Menu</span>
			</button>
		</div>
	</header>

	{#if menuOpen}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<nav
			class="panel"
			id="nav-panel"
			bind:this={panel}
			aria-label="Site"
			onkeydown={onPanelKeydown}
		>
			<div class="panel-head">
				<span class="panel-title">Groove Academy</span>
				<button class="panel-close" onclick={closeMenu}>
					<span aria-hidden="true">✕</span>
					<span class="sr-only">Close menu</span>
				</button>
			</div>
			<ul class="panel-links">
				{#each links as link (link.href)}
					<li>
						<a
							href={link.href}
							class:active={active(link)}
							aria-current={active(link) ? 'page' : undefined}>{link.label}</a
						>
					</li>
				{/each}
			</ul>
		</nav>
	{/if}

	<main class="main">
		{@render children()}
	</main>

	<footer class="footer">
		<!-- rel="me" is load-bearing, not decoration: Mastodon fetches the URL in the
		     profile's Website field and only shows it as verified if it finds a link
		     back to the account. That URL is the site root, so this lives in the
		     layout rather than on /news alone. Telegram and GitHub ask for nothing
		     of the kind, so they are plain links. -->
		<a href={MASTODON} target="_blank" rel="me noopener">Mastodon</a>
		<a href={TELEGRAM} target="_blank" rel="noopener">Telegram</a>
		<a href={GITHUB} target="_blank" rel="noopener">GitHub</a>
	</footer>
</div>

<InstallStrip />

<style>
	.app {
		display: flex;
		/* dvh so the footer lands at the bottom of what is visible, not below
		   retracted browser chrome. The run overlay deliberately does NOT use
		   this — see the note on .highway-full in lessons/[id]. */
		min-height: 100dvh;
		flex-direction: column;
		max-width: 1080px;
		margin: 0 auto;
		/* The insets are what keeps the page clear of a notch in landscape, now
		   that the viewport meta is viewport-fit=cover. */
		padding: 0 calc(1.25rem + env(safe-area-inset-right)) 0
			calc(1.25rem + env(safe-area-inset-left));
	}


	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: nowrap;
		padding: 0.85rem 0;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--border);
	}

	.brand {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.6rem;
		text-decoration: none;
		color: var(--text);
	}

	/* The brand and the footer link are the two navigational targets that are
	   text rather than controls, so the global button sizing does not reach them.
	   Height only — stretching an inline link's width would put its hit area over
	   the text beside it. */
	@media (pointer: coarse) {
		.brand,
		.footer a {
			min-height: 44px;
			display: flex;
			align-items: center;
		}
	}

	/* The small-size variant of the mark — the same file the tab icon uses, which
	   is the one that stays legible at this size. It draws its own gold tile and
	   rounded corners, so nothing here paints behind it. */
	.brand-mark {
		display: block;
		width: 1.9rem;
		height: 1.9rem;
	}

	.brand-name {
		font-weight: 700;
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	/*
		At the narrowest supported width the row is the mark, the wordmark, the
		instrument chip and the menu control. The wordmark is the only elastic part,
		so it is what gives; the mark still links home.
	*/
	@media (max-width: 22.5rem) {
		.brand-name {
			display: none;
		}
	}

	/* The chip sits beside the menu control so one group holds the row's right end. */
	.header-end {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.nav {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.nav a {
		font-family: var(--font-mono);
		font-size: 0.9rem;
		text-decoration: none;
		color: var(--text-muted);
		padding: 0.35em 0.75em;
		border-radius: var(--radius-sm);
		transition:
			color 120ms ease,
			background 120ms ease;
	}

	.nav a:hover {
		color: var(--text);
		background: var(--surface-2);
	}

	.nav a.active {
		color: var(--gold);
		background: var(--surface-2);
	}

	/* --- collapsed navigation -------------------------------------------------
	 *
	 * 48rem is MOBILE_BREAKPOINT_REM in $lib/breakpoints.ts, which is the source
	 * of truth — a custom property cannot be used in a media query, so this is
	 * the one place the number is written by hand.
	 */

	.menu-button {
		display: none;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		padding: 0;
		background: transparent;
		border-color: var(--border);
	}

	/* Three lines drawn from one element: the middle is the box, the outer two
	   are its shadows. Fewer nodes than three spans, and it animates as one. */
	.bars,
	.bars::before,
	.bars::after {
		display: block;
		width: 18px;
		height: 2px;
		border-radius: 1px;
		background: var(--text);
	}

	.bars::before,
	.bars::after {
		content: '';
		position: absolute;
	}

	.bars {
		position: relative;
	}

	.bars::before {
		transform: translateY(-6px);
	}

	.bars::after {
		transform: translateY(6px);
	}

	.panel {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		padding: calc(0.85rem + env(safe-area-inset-top))
			calc(1.25rem + env(safe-area-inset-right))
			calc(1.25rem + env(safe-area-inset-bottom))
			calc(1.25rem + env(safe-area-inset-left));
	}

	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.85rem;
		border-bottom: 1px solid var(--border);
	}

	.panel-title {
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.panel-close {
		width: 44px;
		height: 44px;
		padding: 0;
		font-size: 1.1rem;
		background: transparent;
		border-color: var(--border);
	}

	.panel-links {
		list-style: none;
		margin: 0;
		padding: 0.5rem 0 0;
	}

	/* Reading size, not the header's 0.9rem mono: the reason to collapse the nav
	   at all is that a row of condensed links is not something you hit with a
	   thumb. Each row is its own 44px+ target across the full width. */
	.panel-links a {
		display: block;
		padding: 0.85rem 0.5rem;
		font-size: 1.25rem;
		font-weight: 600;
		text-decoration: none;
		color: var(--text);
		border-radius: var(--radius-sm);
	}

	.panel-links a.active {
		color: var(--gold);
		background: var(--surface-2);
	}

	@media (max-width: 48rem) {
		.nav {
			display: none;
		}

		.menu-button {
			display: flex;
		}
	}

	.main {
		flex: 1;
	}

	.footer {
		display: flex;
		justify-content: center;
		gap: 1.5rem;
		padding: 2rem 0 1.25rem;
		margin-top: 2rem;
		border-top: 1px solid var(--border);
	}

	.footer a {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		text-decoration: none;
		color: var(--text-faint);
		transition: color 120ms ease;
	}

	.footer a:hover {
		color: var(--gold);
	}
</style>
