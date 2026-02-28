import { describe } from 'manten';

describe('pkg-entry-points', async () => {
	await import('./specs/pkg-entry-points.js');
	await import('./specs/exports-types.js');
	await import('./specs/null-block.js');
	await import('./specs/merge-conditions.js');
	await import('./specs/no-exports.js');
	await import('./specs/parse-package-exports.js');

	// await import('./specs/nodejs-behavior.js');
});
