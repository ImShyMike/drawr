<script lang="ts">
	/* eslint-disable svelte/prefer-svelte-reactivity */
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { socket } from '$lib/socket';
	import { INITIAL_SCALE } from '$lib/canvas';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import WifiIcon from '@lucide/svelte/icons/wifi';
	import WifiOffIcon from '@lucide/svelte/icons/wifi-off';
	import {
		EMPTY_PIXEL_COLOR,
		getPixelColor,
		getPixelPosition,
		type ConfigPayload,
		type PixelBatch,
		type PixelUpdate,
		type RoomLoadedPayload,
		type StatsPayload
	} from '../../../../shared/socket-types';

	const Canvas = browser
		? import('$lib/Canvas.svelte').then((module) => module.default)
		: new Promise<never>(() => {});

	let { data } = $props<{ data: { slug?: string } }>();

	let roomCode = $state('');
	let joinedRoom = $state('');
	let canvasSize = $state<number | null>(null);
	let connectedClients = $state(0);
	let pixels = $state<PixelUpdate[]>([]);
	let selectedColor = $state('#111827');
	let zoomScale = $state(INITIAL_SCALE);
	let isConnected = $state(socket.connected);
	let canvasRef = $state<{ resetViewFromParent?: () => void } | null>(null);

	function mergePixels(currentPixels: PixelUpdate[], updates: PixelBatch) {
		const nextPixelsByPosition = new Map(
			currentPixels.map((pixel) => [getPixelPosition(pixel), pixel])
		);

		for (const update of updates) {
			const pixelPosition = getPixelPosition(update);

			if (getPixelColor(update) === EMPTY_PIXEL_COLOR) {
				nextPixelsByPosition.delete(pixelPosition);
			} else {
				nextPixelsByPosition.set(pixelPosition, update);
			}
		}

		return [...nextPixelsByPosition.values()];
	}

	onMount(() => {
		const roomSlug = data.slug ?? '';
		const roomCodeFromUrl = roomSlug.trim();

		const handleConnect = () => {
			isConnected = true;
			if (roomCodeFromUrl && !joinedRoom) {
				joinRoom(roomCodeFromUrl);
			}
		};

		const handleDisconnect = () => {
			isConnected = false;
			joinedRoom = '';
			pixels = [];
			connectedClients = 0;
		};

		const handleConfig = (data: ConfigPayload) => {
			canvasSize = data.canvasSize;
		};

		const handleStats = (data: StatsPayload) => {
			connectedClients = data.connectedClients;
		};

		const handleRoomLoaded = (data: RoomLoadedPayload) => {
			joinedRoom = data.roomCode;
			pixels = [...data.pixels];
			syncRoomSlugInUrl(data.roomCode);
		};

		const handlePixelUpdates = (updates: PixelBatch) => {
			pixels = mergePixels(pixels, updates);
		};

		socket.on('connect', handleConnect);
		socket.on('disconnect', handleDisconnect);
		socket.on('config', handleConfig);
		socket.on('stats', handleStats);
		socket.on('room', handleRoomLoaded);
		socket.on('pixels', handlePixelUpdates);

		if (socket.connected) {
			handleConnect();
		}

		if (roomCodeFromUrl) {
			roomCode = roomCodeFromUrl;
		}

		return () => {
			socket.off('connect', handleConnect);
			socket.off('disconnect', handleDisconnect);
			socket.off('config', handleConfig);
			socket.off('stats', handleStats);
			socket.off('room', handleRoomLoaded);
			socket.off('pixels', handlePixelUpdates);
		};
	});

	function syncRoomSlugInUrl(roomCode: string) {
		if (!browser) {
			return;
		}

		const nextPath = `/${roomCode}`;

		if (window.location.pathname !== nextPath) {
			window.history.replaceState({}, '', nextPath);
		}
	}

	function joinRoom(nextRoomCode = roomCode) {
		nextRoomCode = nextRoomCode.trim();

		if (!nextRoomCode) {
			return;
		}

		roomCode = nextRoomCode;
		socket.emit('room', nextRoomCode);
	}

	function paintPixels(updates: PixelBatch) {
		if (!joinedRoom) {
			return;
		}

		pixels = mergePixels(pixels, updates);
		socket.emit('pixels', updates);
	}
</script>

<section class="room-page">
	<header
		class="flex flex-row items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 text-card-foreground"
	>
		<div class="flex flex-wrap items-center gap-2">
			<PaletteIcon size={16} class="text-muted-foreground" />
			<span class="text-muted-foreground">Color</span>
			<input
				aria-label="Paint color"
				type="color"
				bind:value={selectedColor}
				class="h-6 w-6 cursor-pointer rounded-full border border-border bg-transparent p-0"
			/>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			{#if isConnected}
				<WifiIcon size={16} class="text-emerald-600" />
				<span class="text-foreground">Connected</span>
				<span class="text-muted-foreground">{connectedClients} online</span>
			{:else}
				<WifiOffIcon size={16} class="text-rose-600" />
				<span class="text-foreground">Disconnected</span>
			{/if}
		</div>
	</header>

	<div class="canvas-wrapper">
		{#if canvasSize}
			{#await Canvas}
				<div class="canvas-placeholder">
					<p>Loading canvas…</p>
				</div>
			{:then Canvas}
				{#key canvasSize}
					<Canvas
						bind:this={canvasRef}
						{canvasSize}
						{pixels}
						bind:selectedColor
						bind:scale={zoomScale}
						onPaintPixels={paintPixels}
					/>
				{/key}
			{/await}
		{:else}
			<div class="canvas-placeholder">
				<p>{isConnected ? 'Loading canvas…' : 'Connecting to server…'}</p>
			</div>
		{/if}
	</div>
</section>

<style>
	.room-page {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		height: 100vh;
		width: 100%;
		padding: 0;
		margin: 0;
		box-sizing: border-box;
		background: #f8fafc;
	}

	.canvas-wrapper {
		flex: 1 1 auto;
		min-height: 0;
		min-width: 0;
		width: 100%;
		height: 100%;
		position: relative;
	}

	.canvas-placeholder {
		display: grid;
		place-items: center;
		flex: 1 1 auto;
		min-height: 0;
		color: #475569;
		font-size: 0.95rem;
		width: 100%;
		height: 100%;
		position: relative;
		overflow: hidden;
		background:
			linear-gradient(45deg, var(--muted) 25%, transparent 25%),
			linear-gradient(-45deg, var(--muted) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, var(--muted) 75%),
			linear-gradient(-45deg, transparent 75%, var(--muted) 75%);
		background-position:
			0 0,
			0 8px,
			8px -8px,
			-8px 0;
		background-size: 16px 16px;
		box-shadow: 0 12px 32px rgb(15 23 42 / 8%);
		touch-action: none;
	}
</style>
