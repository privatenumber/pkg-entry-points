import { describe } from 'manten';

describe('pkg-entry-points', ({ runTestSuite }) => {
	runTestSuite(import('./specs/pkg-entry-points.js'));
	runTestSuite(import('./specs/exports-types.js'));
	runTestSuite(import('./specs/null-block.js'));
	runTestSuite(import('./specs/real-packages.js'));
	runTestSuite(import('./specs/merge-conditions.js'));
	runTestSuite(import('./specs/no-exports.js'));

	// runTestSuite(import('./specs/nodejs-behavior.js'));
});
