import { testSuite, expect } from 'manten';
import { createPackage, createPkgJson } from '../utils.js';
import { getPackageEntryPoints } from '#pkg-entry-points';

export default testSuite(({ describe }) => {
	describe('merge conditions', ({ test }) => {
		test('different paths', async () => {
			const {
				fixture,
				packagePath,
				assertSubpath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						exports: {
							conditionA: {
								conditionB: './file1.mjs',
							},
							conditionB: {
								conditionA: './file2.mjs',
							},
						},
					}),
					'file1.mjs': 'export default 123',
					'file2.mjs': 'export default 123',
				},
			});

			// Despite the order of conditions, they both resolve to the same path
			expect(await assertSubpath('pkg', ['conditionA', 'conditionB'])).toMatch('/file1.mjs');
			expect(await assertSubpath('pkg', ['conditionB', 'conditionA'])).toMatch('/file1.mjs');

			expect(await getPackageEntryPoints(packagePath)).toStrictEqual({
				'.': [
					[['conditionA', 'conditionB'], './file1.mjs'],
				],
			});

			await fixture.rm();
		});

		test('nulls with null', async () => {
			const {
				fixture,
				packagePath,
				assertSubpath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						exports: {
							conditionA: {
								conditionB: null,
							},
							conditionB: {
								conditionA: null,
							},
						},
					}),
				},
			});

			await expect(
				() => assertSubpath('pkg', ['conditionA', 'conditionB']),
			).rejects.toThrow('ERR_PACKAGE_PATH_NOT_EXPORTED');

			expect(await getPackageEntryPoints(packagePath)).toStrictEqual({});

			await fixture.rm();
		});

		test('string with null - string wins', async () => {
			const {
				fixture,
				packagePath,
				assertSubpath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						exports: {
							conditionA: {
								conditionB: './file.mjs',
							},
							conditionB: {
								conditionA: null,
							},
						},
					}),
					'file.mjs': 'export default 123',
				},
			});

			expect(await assertSubpath('pkg', ['conditionA', 'conditionB'])).toMatch('/file.mjs');

			expect(await getPackageEntryPoints(packagePath)).toStrictEqual({
				'.': [
					[['conditionA', 'conditionB'], './file.mjs'],
				],
			});

			await fixture.rm();
		});

		test('null with string - null wins', async () => {
			const {
				fixture,
				packagePath,
				assertSubpath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						exports: {
							conditionA: {
								conditionB: null,
							},
							conditionB: {
								conditionA: './file.mjs',
							},
						},
					}),
					'file.mjs': 'export default 123',
				},
			});

			await expect(
				() => assertSubpath('pkg', ['conditionA', 'conditionB']),
			).rejects.toThrow('ERR_PACKAGE_PATH_NOT_EXPORTED');

			expect(await getPackageEntryPoints(packagePath)).toStrictEqual({});

			await fixture.rm();
		});
	});
});
