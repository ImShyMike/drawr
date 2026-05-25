import { type AnyElement } from '../../shared/socket-types';
import { ROOM_TTL_MS, MAX_ROOM_COUNT } from '../index';

interface RoomState {
	elements: AnyElement[];
	ttlTimeout?: ReturnType<typeof setTimeout>;
}

const rooms: { [roomCode: string]: RoomState } = {};

export function getRoomElements(roomCode: string) {
	return rooms[roomCode]?.elements ?? [];
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

	rooms[roomCode] = { elements: [] };
	resetRoomTtl(roomCode);
	return rooms[roomCode];
}

export function getElementById(roomCode: string, elementId: string) {
	const room = rooms[roomCode];
	const element = room?.elements.find(({ id }) => id === elementId);
	return element;
}
