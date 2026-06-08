import { testSuite } from 'manten';
import { expectTypeOf } from 'expect-type';
import type { ConditionToPath, PackageEntryPoints } from '#pkg-entry-points';

/**
 * The README documents `PackageEntryPoints` and `ConditionToPath` as the
 * public return types, so they must stay importable from the package entry
 * with their documented shape. These assertions are checked by `type-check`:
 * it fails if either export is dropped or its shape drifts.
 */
export default testSuite(({ test }) => {
	test('re-exports its documented public types', () => {
		expectTypeOf<ConditionToPath>().toEqualTypeOf<
			[conditions: string[], internalPath: string]
		>();

		expectTypeOf<PackageEntryPoints>().toEqualTypeOf<{
			[subpath: string]: ConditionToPath[];
		}>();
	});
});
