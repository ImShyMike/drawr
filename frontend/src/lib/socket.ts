import { browser } from '$app/environment';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/socket-types';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
	'http://localhost:3000',
	{
		autoConnect: false
	}
);

if (browser) {
	socket.connect();
}
