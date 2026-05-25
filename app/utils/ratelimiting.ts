import { RATE_LIMIT_WINDOW_MS, MAX_EVENTS_PER_WINDOW } from '../index';

export function createRateLimiter() {
	let windowStartedAt = Date.now();
	let eventCount = 0;

	return () => {
		const now = Date.now();

		if (now - windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
			windowStartedAt = now;
			eventCount = 0;
		}

		eventCount += 1;
		return eventCount <= MAX_EVENTS_PER_WINDOW;
	};
}
