export const CANVAS_SIZE = 256;
export const PIXEL_BATCH_INTERVAL_MS = 75;
export const MAX_PIXEL_UPDATES_PER_BATCH = 5_000;
export const COLOR_BITS = 24;
export const COLOR_SPACE_SIZE = 2 ** COLOR_BITS;
export const MAX_COLOR_VALUE = COLOR_SPACE_SIZE - 1;
export const CANVAS_PIXEL_COUNT = CANVAS_SIZE * CANVAS_SIZE;
export const MAX_PACKED_PIXEL_VALUE = CANVAS_PIXEL_COUNT * COLOR_SPACE_SIZE - 1;
export const EMPTY_PIXEL_COLOR = 0xffffff;

export type PixelUpdate = number;
export type PixelBatch = PixelUpdate[];

export function packPixelUpdate(
	x: number,
	y: number,
	color: number,
	canvasSize = CANVAS_SIZE
): PixelUpdate {
	return (y * canvasSize + x) * COLOR_SPACE_SIZE + color;
}

export function getPixelPosition(pixel: PixelUpdate) {
	return Math.floor(pixel / COLOR_SPACE_SIZE);
}

export function getPixelColor(pixel: PixelUpdate) {
	return pixel % COLOR_SPACE_SIZE;
}

export function getPixelX(pixel: PixelUpdate, canvasSize = CANVAS_SIZE) {
	return getPixelPosition(pixel) % canvasSize;
}

export function getPixelY(pixel: PixelUpdate, canvasSize = CANVAS_SIZE) {
	return Math.floor(getPixelPosition(pixel) / canvasSize);
}

export interface ConfigPayload {
	canvasSize: number;
}

export interface StatsPayload {
	requestsPerSecond: number;
	connectedClients: number;
}

export interface RoomLoadedPayload {
	roomCode: string;
	pixels: PixelUpdate[];
}

export interface ServerToClientEvents {
	config: (data: ConfigPayload) => void;
	stats: (data: StatsPayload) => void;
	room: (data: RoomLoadedPayload) => void;
	pixels: (updates: PixelBatch) => void;
}

export interface ClientToServerEvents {
	room: (roomCode: string) => void;
	pixels: (updates: PixelBatch) => void;
}

export interface SocketData {
	roomCode?: string;
}
