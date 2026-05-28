import { Server } from 'socket.io';
import { createServer } from 'http';
import { CANVAS_SIZE, PIXEL_BATCH_INTERVAL_MS } from '../shared/socket-types';
import { parsePixelBatch, validateRoomCode } from './utils/validation';
import { applyPixelUpdates, getOrCreateRoom, getRoomPixels, resetRoomTtl } from './utils/rooms';
import type {
	ClientToServerEvents,
	PixelUpdate,
	ServerToClientEvents,
	SocketData
} from '../shared/socket-types';

const httpServer = createServer();

const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,https://drawr.shymike.dev')
	.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean);

const allowedOrigins = new Set(corsOrigins);

const io = new Server<
	ClientToServerEvents,
	ServerToClientEvents,
	Record<string, never>,
	SocketData
>(httpServer, {
	cors: {
		origin: (origin, callback) => {
			if (!origin || allowedOrigins.has(origin)) {
				callback(null, true);
				return;
			}

			callback(new Error(`CORS rejected for origin: ${origin}`));
		}
	}
});

export const MAX_ROOM_COUNT = 100;
export const ROOM_TTL_MS = 60 * 60 * 1_000;
export const STATS_INTERVAL_MS = 1_000;

const pendingPixelUpdatesByRoom = new Map<string, PixelUpdate[]>();
let requestsThisSecond = 0;

function getStats() {
	return {
		requestsPerSecond: requestsThisSecond,
		connectedClients: io.of('/').sockets.size
	};
}

function emitStats() {
	io.emit('stats', getStats());
}

setInterval(() => {
	for (const [roomCode, pendingUpdates] of pendingPixelUpdatesByRoom) {
		if (pendingUpdates.length === 0) {
			continue;
		}

		const updates = pendingUpdates.slice();
		pendingUpdates.length = 0;
		io.to(roomCode).emit('pixels', updates);
	}
}, PIXEL_BATCH_INTERVAL_MS);

setInterval(() => {
	emitStats();
	requestsThisSecond = 0;
}, STATS_INTERVAL_MS);

function queuePixelUpdates(roomCode: string, updates: PixelUpdate[]) {
	let pendingUpdates = pendingPixelUpdatesByRoom.get(roomCode);

	if (!pendingUpdates) {
		pendingUpdates = [];
		pendingPixelUpdatesByRoom.set(roomCode, pendingUpdates);
	}

	pendingUpdates.push(...updates);
}

io.on('connection', (socket) => {
	console.log('connected', socket.id);
	socket.emit('config', { canvasSize: CANVAS_SIZE });
	socket.emit('stats', getStats());
	emitStats();

	socket.use((_, next) => {
		requestsThisSecond += 1;
		next();
	});

	socket.on('room', (roomCode) => {
		const nextRoomCode = validateRoomCode(roomCode);

		if (!nextRoomCode) {
			console.warn(`invalid room code: ${roomCode}`);
			return;
		}

		const room = getOrCreateRoom(nextRoomCode);

		if (!room) {
			console.warn(`ignored room: max room count reached`);
			return;
		}

		if (socket.data.roomCode) {
			socket.leave(socket.data.roomCode);
		}

		socket.data.roomCode = nextRoomCode;
		socket.join(nextRoomCode);

		socket.emit('config', { canvasSize: CANVAS_SIZE });
		socket.emit('room', { roomCode: nextRoomCode, pixels: getRoomPixels(nextRoomCode) });
		resetRoomTtl(nextRoomCode);

		console.log(`${socket.id} joined ${nextRoomCode}`);
	});

	socket.on('pixels', (updates) => {
		const roomCode = socket.data.roomCode;

		if (!roomCode) {
			return;
		}

		const room = getOrCreateRoom(roomCode);

		if (!room) {
			console.warn(`ignored pixels: max room count reached`);
			return;
		}

		const sanitizedUpdates = parsePixelBatch(updates);

		if (!sanitizedUpdates) {
			console.warn(`ignored pixels: invalid update payload`);
			return;
		}

		applyPixelUpdates(roomCode, sanitizedUpdates);
		queuePixelUpdates(roomCode, sanitizedUpdates);
		resetRoomTtl(roomCode);
	});

	socket.on('disconnect', () => {
		console.log('disconnect', socket.id);
		emitStats();
	});
});

const port = Number(process.env.PORT ?? '3000');
const host = '0.0.0.0';

httpServer.listen(port, host, () => {
	console.log(`listening on http://${host}:${port}`);
});
