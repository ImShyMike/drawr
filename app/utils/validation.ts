import { elementSchema, updateSchemas } from '../../shared/socket-types';
import type { AnyElement, AnyElementUpdate } from '../../shared/socket-types';

export function parseElement(element: unknown): AnyElement | null {
	const result = elementSchema.safeParse(element);
	return result.success ? result.data : null;
}

export function parseUpdate(element: AnyElement, update: unknown): AnyElementUpdate | null {
	const result = updateSchemas[element.type].safeParse(update);
	return result.success ? result.data : null;
}

export function validateRoomCode(roomCode: string) {
	const trimmed = roomCode.trim();
	if (trimmed.length != 6 || !/^[A-Z0-9]+$/.test(trimmed)) {
		return undefined;
	}
	return trimmed;
}
