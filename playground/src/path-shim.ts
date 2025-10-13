/**
 * Minimal path shim for browser environment.
 * Implements the subset of path functions used by pkg-entry-points.
 */

export function join(...segments: string[]): string {
	// Filter out empty segments and join with '/'
	return segments
		.filter(segment => segment && segment !== '.')
		.join('/')
		.replace(/\/+/g, '/'); // Normalize multiple slashes
}

export function resolve(...segments: string[]): string {
	let resolvedPath = '';

	for (let i = segments.length - 1; i >= 0; i -= 1) {
		const segment = segments[i];

		if (!segment) {
			continue;
		}

		if (segment.startsWith('/')) {
			resolvedPath = segment;
			break;
		}

		resolvedPath = segment + (resolvedPath ? `/${resolvedPath}` : '');
	}

	// If still relative, treat as absolute from root
	if (!resolvedPath.startsWith('/')) {
		resolvedPath = `/${resolvedPath}`;
	}

	return resolvedPath;
}

export function relative(from: string, to: string): string {
	const fromParts = from.split('/').filter(Boolean);
	const toParts = to.split('/').filter(Boolean);

	// Find common base
	let i = 0;
	while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
		i += 1;
	}

	// Build relative path
	const upCount = fromParts.length - i;
	const remainingParts = toParts.slice(i);

	const relativeParts = [
		...Array.from({ length: upCount }, () => '..'),
		...remainingParts,
	];

	return relativeParts.join('/') || '.';
}

export default {
	join,
	resolve,
	relative,
};
