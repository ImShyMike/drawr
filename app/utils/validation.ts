import { MAX_PACKED_PIXEL_VALUE, MAX_PIXEL_UPDATES_PER_BATCH } from '../../shared/socket-types';
import type { PixelBatch, PixelUpdate } from '../../shared/socket-types';

export function parsePixelBatch(updates: unknown): PixelBatch | null {
	if (
		!Array.isArray(updates) ||
		updates.length === 0 ||
		updates.length > MAX_PIXEL_UPDATES_PER_BATCH
	) {
		return null;
	}

	for (const update of updates) {
		if (!isPixelUpdate(update)) {
			return null;
		}
	}

	return updates;
}

function isPixelUpdate(update: unknown): update is PixelUpdate {
	return (
		typeof update === 'number' &&
		Number.isInteger(update) &&
		update >= 0 &&
		update <= MAX_PACKED_PIXEL_VALUE
	);
}

export function validateRoomCode(roomCode: string) {
	const trimmed = roomCode.trim();
	if (trimmed.length != 6 || !/^[0-9]+$/.test(trimmed)) {
		return undefined;
	}
	return trimmed;
}
