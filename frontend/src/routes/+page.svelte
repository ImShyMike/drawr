<script lang="ts">
	import { onMount } from 'svelte';
	import { socket } from '$lib/socket';
	import type { AnyElement, AnyElementUpdate, RoomLoadedPayload } from '../../../shared/socket-types';

	let roomCode = $state('');
	let joinedRoom = $state('');
	let elements = $state<AnyElement[]>([]);
	let status = $state('Not connected');

	onMount(() => {
		const handleConnect = () => {
			status = `Connected as ${socket.id}`;
		};

		const handleDisconnect = () => {
			status = 'Disconnected';
			joinedRoom = '';
		};

		const handleRoomLoaded = (data: RoomLoadedPayload) => {
			joinedRoom = data.roomCode;
			elements = data.elements;
			status = `Joined room ${data.roomCode}`;
		};

		const handleElementCreated = (element: AnyElement) => {
			elements = [...elements, element];
		};

		const handleElementUpdated = (update: AnyElementUpdate) => {
			elements = elements.map((element) =>
				element.id === update.id ? ({ ...element, ...update } as AnyElement) : element
			);
		};

		socket.on('connect', handleConnect);
		socket.on('disconnect', handleDisconnect);
		socket.on('room-loaded', handleRoomLoaded);
		socket.on('element-created', handleElementCreated);
		socket.on('element-updated', handleElementUpdated);

		if (socket.connected) {
			handleConnect();
		}

		return () => {
			socket.off('connect', handleConnect);
			socket.off('disconnect', handleDisconnect);
			socket.off('room-loaded', handleRoomLoaded);
			socket.off('element-created', handleElementCreated);
			socket.off('element-updated', handleElementUpdated);
		};
	});

	function joinRoom() {
		const nextRoomCode = roomCode.trim();

		if (!nextRoomCode) {
			status = 'Enter a room code first';
			return;
		}

		socket.emit('join-room', nextRoomCode);
	}
</script>

<section>
	<form
		onsubmit={(event) => {
			event.preventDefault();
			joinRoom();
		}}
	>
		<label>
			Room code
			<input bind:value={roomCode} placeholder="ABC123" />
		</label>

		<button type="submit">Join room</button>
	</form>

	<p>{status}</p>

	{#if joinedRoom}
		<p>Loaded {elements.length} element{elements.length === 1 ? '' : 's'} in {joinedRoom}.</p>
	{/if}
</section>
