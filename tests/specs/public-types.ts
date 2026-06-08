import { testSuite, expect } from 'manten';
import type { ConditionToPath, PackageEntryPoints } from '#pkg-entry-points';

/**
 * The README documents `PackageEntryPoints` and `ConditionToPath` as the
 * public return types, so they must be importable from the package entry.
 * Annotating these values is the real assertion: `type-check` fails if either
 * type stops being exported. The runtime check just exercises the shape.
 */
export default testSuite(({ test }) => {
	test('re-exports its documented public types', () => {
		const conditionToPath: ConditionToPath = [['default'], './index.js'];
		const entryPoints: PackageEntryPoints = {
			'.': [conditionToPath],
		};

		expect(entryPoints).toStrictEqual({
			'.': [[['default'], './index.js']],
		});
	});
});
