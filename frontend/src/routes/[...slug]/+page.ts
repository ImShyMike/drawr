import { error } from '@sveltejs/kit';

export function load({ params }) {
	const raw = params.slug ?? '';

	if (!raw) {
		return { slug: '' };
	}

	const slug = raw.trim().toUpperCase();

	if (!/^[A-Z0-9]{6}$/.test(slug)) {
		throw error(404, 'Not found');
	}

	return { slug };
}
