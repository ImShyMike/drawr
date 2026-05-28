import { Server } from 'socket.io';
import { createServer } from 'http';
import { PIXEL_BATCH_INTERVAL_MS } from '../shared/socket-types';
import { parsePixelBatch, validateRoomCode } from './utils/validation';
import {
	applyPixelUpdates,
	getOrCreateRoom,
	getPixelUpdateKey,
	getRoomPixels,
	resetRoomTtl
} from './utils/rooms';
import { createRateLimiter } from './utils/ratelimiting';
import type {
	ClientToServerEvents,
	PixelUpdate,
	ServerToClientEvents,
	SocketData
} from '../shared/socket-types';

const httpServer = createServer();

const io = new Server<
	ClientToServerEvents,
	ServerToClientEvents,
	Record<string, never>,
	SocketData
>(httpServer, {
	cors: {
		origin: 'http://localhost:5173'
	}
});

export const MAX_ROOM_COUNT = 100;
export const ROOM_TTL_MS = 60 * 60 * 1_000;
export const CLIENT_EVENT_INTERVAL_MS = PIXEL_BATCH_INTERVAL_MS;

const pendingPixelUpdatesByRoom = new Map<string, Map<string, PixelUpdate>>();

setInterval(() => {
	for (const [roomCode, pendingUpdates] of pendingPixelUpdatesByRoom) {
		if (pendingUpdates.size === 0) {
			continue;
		}

		const updates = [...pendingUpdates.values()];
		pendingUpdates.clear();
		io.to(roomCode).emit('pixel-updates', updates);
	}
}, PIXEL_BATCH_INTERVAL_MS);

function queuePixelUpdates(roomCode: string, updates: PixelUpdate[]) {
	let pendingUpdates = pendingPixelUpdatesByRoom.get(roomCode);

	if (!pendingUpdates) {
		pendingUpdates = new Map();
		pendingPixelUpdatesByRoom.set(roomCode, pendingUpdates);
	}

	for (const update of updates) {
		pendingUpdates.set(getPixelUpdateKey(update), update);
	}
}

io.on('connection', (socket) => {
	const canHandleEvent = createRateLimiter();

	console.log('connected', socket.id);

	socket.use(([eventName], next) => {
		if (!canHandleEvent()) {
			console.warn(`rate limited ${socket.id} on ${String(eventName)}`);
			next(new Error('rate limit exceeded'));
			return;
		}

		next();
	});

	socket.on('join-room', (roomCode) => {
		const nextRoomCode = validateRoomCode(roomCode);

		if (!nextRoomCode) {
			console.warn(`invalid room code: ${roomCode}`);
			return;
		}

		const room = getOrCreateRoom(nextRoomCode);

		if (!room) {
			console.warn(`ignored join-room: max room count reached`);
			return;
		}

		if (socket.data.roomCode) {
			socket.leave(socket.data.roomCode);
		}

		socket.data.roomCode = nextRoomCode;
		socket.join(nextRoomCode);

		socket.emit('room-loaded', { roomCode: nextRoomCode, pixels: getRoomPixels(nextRoomCode) });
		resetRoomTtl(nextRoomCode);

		console.log(`${socket.id} joined ${nextRoomCode}`);
	});

	socket.on('pixel-updates', (updates) => {
		const roomCode = socket.data.roomCode;

		if (!roomCode) {
			return;
		}

		const room = getOrCreateRoom(roomCode);

		if (!room) {
			console.warn(`ignored pixel-updates: max room count reached`);
			return;
		}

		const sanitizedUpdates = parsePixelBatch(updates);

		if (!sanitizedUpdates) {
			console.warn(`ignored pixel-updates: invalid update payload`);
			return;
		}

		applyPixelUpdates(roomCode, sanitizedUpdates);
		queuePixelUpdates(roomCode, sanitizedUpdates);
		resetRoomTtl(roomCode);
	});

	socket.on('disconnect', () => {
		console.log('disconnect', socket.id);
	});
});

httpServer.listen(3000);
