import { pixelBatchSchema } from '../../shared/socket-types';
import type { PixelBatch } from '../../shared/socket-types';

export function parsePixelBatch(updates: unknown): PixelBatch | null {
	const result = pixelBatchSchema.safeParse(updates);
	return result.success ? result.data : null;
}

export function validateRoomCode(roomCode: string) {
	const trimmed = roomCode.trim();
	if (trimmed.length != 6 || !/^[A-Z0-9]+$/.test(trimmed)) {
		return undefined;
	}
	return trimmed;
}
