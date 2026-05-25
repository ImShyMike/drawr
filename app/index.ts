import { Server } from 'socket.io';
import { createServer } from 'http';
import { updateIdSchema } from '../shared/socket-types';
import { parseElement, parseUpdate, validateRoomCode } from './utils/validation';
import { resetRoomTtl, getOrCreateRoom, getElementById } from './utils/rooms';
import { createRateLimiter } from './utils/ratelimiting';
import type {
	ClientToServerEvents,
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
export const MAX_ELEMENTS_PER_ROOM = 1_000;
export const ROOM_TTL_MS = 60 * 60 * 1_000;
export const RATE_LIMIT_WINDOW_MS = 10_000;
export const MAX_EVENTS_PER_WINDOW = 200;

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

		socket.emit('room-loaded', { roomCode: nextRoomCode, elements: room.elements });
		resetRoomTtl(nextRoomCode);

		console.log(`${socket.id} joined ${nextRoomCode}`);
	});

	socket.on('create-element', (element) => {
		const roomCode = socket.data.roomCode;

		if (!roomCode) {
			return;
		}

		const room = getOrCreateRoom(roomCode);

		if (!room) {
			console.warn(`ignored create-element: max room count reached`);
			return;
		}

		if (room.elements.length >= MAX_ELEMENTS_PER_ROOM) {
			console.warn(`ignored create-element: max element count reached for ${roomCode}`);
			return;
		}

		const sanitizedElement = parseElement(element);

		if (!sanitizedElement) {
			console.warn(`ignored create-element: invalid element payload`);
			return;
		}

		room.elements.push(sanitizedElement);
		io.to(roomCode).emit('element-created', sanitizedElement);
	});

	socket.on('update-element', (update) => {
		const roomCode = socket.data.roomCode;

		if (!roomCode) {
			return;
		}

		const updateId = updateIdSchema.safeParse(update);

		if (!updateId.success) {
			console.warn(`ignored update-element: invalid update payload`);
			return;
		}

		const element = getElementById(roomCode, updateId.data.id);

		if (!element) {
			return;
		}

		resetRoomTtl(roomCode);

		const sanitizedUpdate = parseUpdate(element, update);

		if (!sanitizedUpdate) {
			console.warn(`ignored update-element: invalid update payload`);
			return;
		}

		const { id: _id, ...changes } = sanitizedUpdate;
		Object.assign(element, changes);

		io.to(roomCode).emit('element-updated', sanitizedUpdate);
	});

	socket.on('disconnect', () => {
		console.log('disconnect', socket.id);
	});
});

httpServer.listen(3000);
