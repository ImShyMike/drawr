import { CLIENT_EVENT_INTERVAL_MS } from '../index';

export function createRateLimiter() {
	let lastEventAt = 0;

	return () => {
		const now = Date.now();

		if (now - lastEventAt < CLIENT_EVENT_INTERVAL_MS) {
			return false;
		}

		lastEventAt = now;
		return true;
	};
}
