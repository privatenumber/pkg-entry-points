import { testSuite, expect } from 'manten';
import { createPackage, createPkgJson } from '../utils.js';
import { getPackageEntryPoints } from '#pkg-entry-points';

export default testSuite(({ describe }) => {
	describe('no exports', ({ test }) => {
		test('no exports should list all files', async () => {
			const {
				fixture,
				assertSubpath,
				packagePath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						main: './main.mjs',
					}),
					'README.md': 'hello',
					'main.mjs': 'export default 123',
					'a.mjs': 'export default 123',
					'directory/b.mjs': 'export default 123',
				},
			});

			await assertSubpath('pkg/a.mjs', []);

			const packageExports = await getPackageEntryPoints(packagePath);
			expect(packageExports).toStrictEqual({
				'.': [
					[['default'], './main.mjs'],
				],
				'./main.mjs': [[['default'], './main.mjs']],
				'./a.mjs': [[['default'], './a.mjs']],
				'./directory/b.mjs': [[['default'], './directory/b.mjs']],
				'./package.json': [
					[['default'], './package.json'],
				],
			});

			await fixture.rm();
		});

		test('no main should fallback to index.js', async () => {
			const {
				fixture,
				assertSubpath,
				packagePath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({}),
					'index.js': 'export default 123',
				},
			});

			await assertSubpath('pkg', []);

			const packageExports = await getPackageEntryPoints(packagePath);
			expect(packageExports).toStrictEqual({
				'.': [
					[['default'], './index.js'],
				],
				'./index.js': [
					[['default'], './index.js'],
				],
				'./package.json': [
					[['default'], './package.json'],
				],
			});

			await fixture.rm();
		});

		test('invalid main', async () => {
			const {
				fixture,
				assertSubpath,
				packagePath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						main: './missing-file.js',
					}),
					'index.js': 'export default 123',
				},
			});

			await assertSubpath('pkg', []);

			const packageExports = await getPackageEntryPoints(packagePath);
			expect(packageExports).toStrictEqual({
				'./index.js': [
					[['default'], './index.js'],
				],
				'./package.json': [
					[['default'], './package.json'],
				],
			});

			await fixture.rm();
		});
	});
});
