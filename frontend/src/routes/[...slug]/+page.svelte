<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { socket } from '$lib/socket';
	import type { PixelBatch, PixelUpdate, RoomLoadedPayload } from '../../../../shared/socket-types';

	const Canvas = browser
		? import('$lib/Canvas.svelte').then((module) => module.default)
		: new Promise<never>(() => {});

	let { data } = $props<{ data: { slug?: string } }>();

	let roomCode = $state('');
	let joinedRoom = $state('');
	let pixels = $state<PixelUpdate[]>([]);

	function mergePixels(currentPixels: PixelUpdate[], updates: PixelBatch) {
		const nextPixelsByKey = new Map(currentPixels.map((pixel) => [`${pixel.x},${pixel.y}`, pixel]));

		for (const update of updates) {
			const pixelKey = `${update.x},${update.y}`;

			if (update.color === '#ffffff') {
				nextPixelsByKey.delete(pixelKey);
			} else {
				nextPixelsByKey.set(pixelKey, update);
			}
		}

		return [...nextPixelsByKey.values()];
	}

	onMount(() => {
		const roomSlug = data.slug ?? '';
		const roomCodeFromUrl = roomSlug.trim().toUpperCase();

		const handleConnect = () => {
			if (roomCodeFromUrl && !joinedRoom) {
				joinRoom(roomCodeFromUrl);
			}
		};

		const handleDisconnect = () => {
			joinedRoom = '';
			pixels = [];
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
		socket.on('room-loaded', handleRoomLoaded);
		socket.on('pixel-updates', handlePixelUpdates);

		if (socket.connected) {
			handleConnect();
		}

		if (roomCodeFromUrl) {
			roomCode = roomCodeFromUrl;
		}

		return () => {
			socket.off('connect', handleConnect);
			socket.off('disconnect', handleDisconnect);
			socket.off('room-loaded', handleRoomLoaded);
			socket.off('pixel-updates', handlePixelUpdates);
		};
	});

	function getRoomSlugFromCode(roomCode: string) {
		return roomCode.trim().toUpperCase();
	}

	function syncRoomSlugInUrl(roomCode: string) {
		if (!browser) {
			return;
		}

		const roomSlug = getRoomSlugFromCode(roomCode);
		const nextPath = `/${roomSlug}`;

		if (window.location.pathname !== nextPath) {
			window.history.replaceState({}, '', nextPath);
		}
	}

	function joinRoom(nextRoomCode = roomCode) {
		nextRoomCode = nextRoomCode.trim().toUpperCase();

		if (!nextRoomCode) {
			return;
		}

		roomCode = nextRoomCode;
		socket.emit('join-room', nextRoomCode);
	}

	function paintPixels(updates: PixelBatch) {
		if (!joinedRoom) {
			return;
		}

		pixels = mergePixels(pixels, updates);
		socket.emit('pixel-updates', updates);
	}
</script>

<section class="room-page">
	{#if joinedRoom}
		<div class="canvas-wrapper">
			{#await Canvas}
				<p>Loading canvas…</p>
			{:then Canvas}
				<Canvas {pixels} onPaintPixels={paintPixels} />
			{/await}
		</div>
	{/if}
</section>

<style>
	.room-page {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		position: fixed;
		inset: 0;
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
	}
</style>
