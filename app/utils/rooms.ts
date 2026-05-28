import { type PixelUpdate } from '../../shared/socket-types';
import { ROOM_TTL_MS, MAX_ROOM_COUNT } from '../index';

interface RoomState {
	pixels: Map<string, PixelUpdate>;
	ttlTimeout?: ReturnType<typeof setTimeout>;
}

const rooms: { [roomCode: string]: RoomState } = {};

function getPixelKey(pixel: Pick<PixelUpdate, 'x' | 'y'>) {
	return `${pixel.x},${pixel.y}`;
}

export function getRoomPixels(roomCode: string) {
	return [...(rooms[roomCode]?.pixels.values() ?? [])];
}

export function applyPixelUpdates(roomCode: string, updates: PixelUpdate[]) {
	const room = rooms[roomCode];

	if (!room) {
		return;
	}

	for (const update of updates) {
		const pixelKey = getPixelKey(update);

		if (update.color === '#ffffff') {
			room.pixels.delete(pixelKey);
		} else {
			room.pixels.set(pixelKey, update);
		}
	}
}

export function getPixelUpdateKey(update: PixelUpdate) {
	return getPixelKey(update);
}

export function deleteRoom(roomCode: string) {
	const room = rooms[roomCode];

	if (!room) {
		return;
	}

	if (room.ttlTimeout) {
		clearTimeout(room.ttlTimeout);
	}

	delete rooms[roomCode];
	console.log(`deleted expired room ${roomCode}`);
}

export function resetRoomTtl(roomCode: string) {
	const room = rooms[roomCode];

	if (!room) {
		return;
	}

	if (room.ttlTimeout) {
		clearTimeout(room.ttlTimeout);
	}

	room.ttlTimeout = setTimeout(() => {
		deleteRoom(roomCode);
	}, ROOM_TTL_MS);
}

export function getOrCreateRoom(roomCode: string) {
	const room = rooms[roomCode];

	if (room) {
		resetRoomTtl(roomCode);
		return room;
	}

	if (Object.keys(rooms).length >= MAX_ROOM_COUNT) {
		return null;
	}

	rooms[roomCode] = { pixels: new Map() };
	resetRoomTtl(roomCode);
	return rooms[roomCode];
}
