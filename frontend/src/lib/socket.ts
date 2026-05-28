import { browser } from '$app/environment';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/socket-types';

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(backendUrl, {
	autoConnect: false
});

if (browser) {
	socket.connect();
}
