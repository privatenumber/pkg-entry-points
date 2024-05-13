import { testSuite, expect } from 'manten';
import { createPackage, createPkgJson, testScenarios } from '../utils.js';

export default testSuite(({ describe }) => {
	for (const { scenario, getPackageEntryPoints } of testScenarios) {
		describe(scenario, ({ describe }) => {
			describe('null block', ({ test }) => {
				test('static subpath', async () => {
					const {
						fixture,
						assertSubpath,
						packagePath,
					} = await createPackage({
						pkg: {
							'package.json': createPkgJson({
								exports: {
									'./a': null,
									'./*': './*.mjs',
								},
							}),
							'a.mjs': 'export default 123',
							'b.mjs': 'export default 123',
						},
					});

					await assertSubpath('pkg/b', []);
					await expect(
						() => assertSubpath('pkg/a', []),
					).rejects.toThrow('ERR_PACKAGE_PATH_NOT_EXPORTED');

					const packageExports = await getPackageEntryPoints(packagePath);
					expect(packageExports).toStrictEqual({
						'./b': [
							[['default'], './b.mjs'],
						],
					});

					await fixture.rm();
				});

				test('static null condition', async () => {
					const {
						fixture,
						assertSubpath,
						packagePath,
					} = await createPackage({
						pkg: {
							'package.json': createPkgJson({
								exports: {
									'condition-a': './a.mjs',
									default: null,
								},
							}),
							'a.mjs': 'export default 123',
						},
					});

					await assertSubpath('pkg', ['condition-a']);
					await expect(
						() => assertSubpath('pkg/a', []),
					).rejects.toThrow('ERR_PACKAGE_PATH_NOT_EXPORTED');

					const packageExports = await getPackageEntryPoints(packagePath);
					expect(packageExports).toStrictEqual({
						'.': [
							[['condition-a'], './a.mjs'],
						],
					});

					await fixture.rm();
				});

				test('subpath with star', async () => {
					const {
						fixture,
						assertSubpath,
						packagePath,
					} = await createPackage({
						pkg: {
							'package.json': createPkgJson({
								exports: {
									'./*.js': './*.js',
									'./internal/*': null,
								},
							}),
							'file-a.js': 'module.exports = 123',
							internal: {
								'file-b.js': 'module.exports = 123',
							},
						},
					});

					await assertSubpath('pkg/file-a.js', []);
					await expect(
						() => assertSubpath('pkg/file-b.js', []),
					).rejects.toThrow('ERR_MODULE_NOT_FOUND');

					const packageExports = await getPackageEntryPoints(packagePath);
					expect(packageExports).toStrictEqual({
						'./file-a.js': [
							[['default'], './file-a.js'],
						],
					});

					await fixture.rm();
				});

				test('subpath with condition', async () => {
					const {
						fixture,
						assertSubpath,
						packagePath,
					} = await createPackage({
						pkg: {
							'package.json': createPkgJson({
								exports: {
									'./*': {
										a: null,
										default: './*.mjs',
									},
								},
							}),
							'a.mjs': 'export default 123',
							'b.mjs': 'export default 123',
						},
					});

					await assertSubpath('pkg/a', []);
					await expect(
						() => assertSubpath('pkg/a', ['a']),
					).rejects.toThrow('ERR_PACKAGE_PATH_NOT_EXPORTED');

					const packageExports = await getPackageEntryPoints(packagePath);
					expect(packageExports).toStrictEqual({
						'./a': [
							[['default'], './a.mjs'],
						],
						'./b': [
							[['default'], './b.mjs'],
						],
					});

					await fixture.rm();
				});

				test('subpath with condition in array', async () => {
					const {
						fixture,
						assertSubpath,
						packagePath,
					} = await createPackage({
						pkg: {
							'package.json': createPkgJson({
								exports: {
									'./*': './dir/*/file-*-*.mjs',
									'./a': [{
										default: null,
										a: './dir/a/file-a-a.mjs',
									}],
								},
							}),
							dir: {
								'a/file-a-a.mjs': 'export default 123',
								'b/file-b-b.mjs': 'export default 123',
								'b/file-shouldnotmatch.mjs': 'export default 123',
								'c/file-c-c.mjs': 'export default 123',
								'd/file-d-d.mjs': 'export default 123',
							},
						},
					});

					await assertSubpath('pkg/b', []);
					await expect(
						() => assertSubpath('pkg/a', []),
					).rejects.toThrow('ERR_PACKAGE_PATH_NOT_EXPORTED');

					const packageExports = await getPackageEntryPoints(packagePath);
					expect(packageExports).toStrictEqual({
						'./a': [[['a'], './dir/a/file-a-a.mjs']],
						'./b': [[['default'], './dir/b/file-b-b.mjs']],
						'./c': [[['default'], './dir/c/file-c-c.mjs']],
						'./d': [[['default'], './dir/d/file-d-d.mjs']],
					});

					await fixture.rm();
				});
			});
		});
	}
});
