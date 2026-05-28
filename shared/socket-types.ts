import { z } from 'zod';

export const CANVAS_SIZE = 1_000;
export const PIXEL_BATCH_INTERVAL_MS = 75;
export const MAX_PIXEL_UPDATES_PER_BATCH = 5_000;

export const pixelUpdateSchema = z.object({
	x: z
		.number()
		.int()
		.min(0)
		.max(CANVAS_SIZE - 1),
	y: z
		.number()
		.int()
		.min(0)
		.max(CANVAS_SIZE - 1),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.transform((color) => color.toLowerCase())
});

export const pixelBatchSchema = z.array(pixelUpdateSchema).min(1).max(MAX_PIXEL_UPDATES_PER_BATCH);

export type PixelUpdate = z.infer<typeof pixelUpdateSchema>;
export type PixelBatch = z.infer<typeof pixelBatchSchema>;

export interface RoomLoadedPayload {
	roomCode: string;
	pixels: PixelUpdate[];
}

export interface ServerToClientEvents {
	'room-loaded': (data: RoomLoadedPayload) => void;
	'pixel-updates': (updates: PixelBatch) => void;
}

export interface ClientToServerEvents {
	'join-room': (roomCode: string) => void;
	'pixel-updates': (updates: PixelBatch) => void;
}

export interface SocketData {
	roomCode?: string;
}
