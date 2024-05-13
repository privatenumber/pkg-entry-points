import { testSuite, expect } from 'manten';
import { createPackage, createPkgJson, testScenarios } from '../utils.js';

export default testSuite(({ describe }) => {
	for (const { scenario, getPackageEntryPoints } of testScenarios) {
		describe(scenario, ({ describe }) => {
			describe('pkg-entry-points', ({ test, describe }) => {
				test('missing files', async () => {
					const {
						fixture,
						packagePath,
					} = await createPackage({
						pkg: {
							'package.json': createPkgJson({
								exports: './file.js',
							}),
						},
					});

					const packageExports = await getPackageEntryPoints(packagePath);
					expect(packageExports).toStrictEqual({});

					await fixture.rm();
				});

				test('missing files in star to star', async () => {
					const {
						fixture,
						packagePath,
					} = await createPackage({
						pkg: {
							'package.json': createPkgJson({
								exports: {
									'./*': './*.js',
								},
							}),
						},
					});

					const packageExports = await getPackageEntryPoints(packagePath);
					expect(packageExports).toStrictEqual({});

					await fixture.rm();
				});

				test('missing files in star to static', async () => {
					const {
						fixture,
						packagePath,
					} = await createPackage({
						pkg: {
							'package.json': createPkgJson({
								exports: {
									'./*': './a.js',
								},
							}),
						},
					});

					const packageExports = await getPackageEntryPoints(packagePath);
					expect(packageExports).toStrictEqual({});

					await fixture.rm();
				});

				test('handles fallback conditions', async () => {
					const {
						fixture,
						assertSubpath,
						packagePath,
					} = await createPackage({
						pkg: {
							'package.json': createPkgJson({
								exports: {
									'.': [
										{
											b: './b.mjs',
											default: null,
										},
										{
											a: './a.mjs',
										},
									],
								},
							}),
							'a.mjs': 'export default 123',
							'b.mjs': 'export default 123',
						},
					});

					expect(await assertSubpath('pkg', ['a'])).toMatch('/a.mjs');
					expect(await assertSubpath('pkg', ['b'])).toMatch('/b.mjs');
					await expect(() => assertSubpath('pkg', [])).rejects.toThrowError('ERR_PACKAGE_PATH_NOT_EXPORTED');

					const packageExports = await getPackageEntryPoints(packagePath);
					expect(packageExports).toStrictEqual({
						'.': [
							[['b'], './b.mjs'],
							[['a'], './a.mjs'],
						],
					});

					await fixture.rm();
				});

				describe('stars', ({ test }) => {
					test('star with no suffix', async () => {
						const {
							fixture,
							assertSubpath,
							packagePath,
						} = await createPackage({
							pkg: {
								'package.json': createPkgJson({
									exports: {
										'./feature/*': './feature/*',
									},
								}),
								feature: {
									'file-a.js': 'module.exports = 123',
								},
							},
						});

						await assertSubpath('pkg/feature/file-a.js', []);

						const packageExports = await getPackageEntryPoints(packagePath);
						expect(packageExports).toStrictEqual({
							'./feature/file-a.js': [
								[['default'], './feature/file-a.js'],
							],
						});

						await fixture.rm();
					});

					test('exports = multi path - conditions object', async () => {
						const {
							fixture,
							assertSubpath,
							packagePath,
						} = await createPackage({
							pkg: {
								'package.json': createPkgJson({
									exports: {
										'.': {
											conditionA: [
												'protocol:./file.mjs',
												'./file.mjs',
											],
											'condition-b': [
												{ conditionC: './file.mjs' },
												{ conditionA: './file.mjs' },
												{ conditionB: null },
											],
										},
										'./subpath': {
											'condition-d': [
												'protocol:./file.mjs',
												'./file.mjs',
											],
											'condition-e': [
												{ conditionA: './file.mjs' },
												{ conditionB: './file.mjs' },
												'./file.mjs',
											],
										},
										'./feature/*.js': './feature/*.js',
										'./feature/internal/*': null,
									},
								}),
								'file.mjs': 'export default 123',
								feature: {
									'file-a.js': 'module.exports = 123',
									internal: {
										'file-b.js': 'module.exports = 123',
									},
								},
							},
						});

						await assertSubpath('pkg', ['conditionA']);
						await assertSubpath('pkg', ['condition-b', 'conditionC']);
						await assertSubpath('pkg/subpath', ['condition-d']);
						await assertSubpath('pkg/subpath', ['condition-e']);
						await assertSubpath('pkg/subpath', ['condition-e', 'conditionA']);
						await assertSubpath('pkg/subpath', ['condition-e', 'conditionB']);

						const packageExports = await getPackageEntryPoints(packagePath);
						expect(packageExports).toStrictEqual({
							'.': [
								[['conditionA'], './file.mjs'],
								[['condition-b', 'conditionC'], './file.mjs'],
								[['condition-b', 'conditionA'], './file.mjs'],
							],
							'./subpath': [
								[['condition-d'], './file.mjs'],
								[['condition-e'], './file.mjs'],
								[['condition-e', 'conditionA'], './file.mjs'],
								[['condition-e', 'conditionB'], './file.mjs'],
							],
							'./feature/file-a.js': [[['default'], './feature/file-a.js']],
						});

						await fixture.rm();
					});

					// Pointless test?
					test('replace stars', async () => {
						const {
							fixture,
							assertSubpath,
							packagePath,
						} = await createPackage({
							pkg: {
								'package.json': createPkgJson({
									exports: {
										'./*': './dir/*/file-*-*.mjs',
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

						await assertSubpath('pkg/a', []);

						const packageExports = await getPackageEntryPoints(packagePath);
						expect(packageExports).toStrictEqual({
							'./a': [
								[['default'], './dir/a/file-a-a.mjs'],
							],
							'./b': [
								[['default'], './dir/b/file-b-b.mjs'],
							],
							'./c': [
								[['default'], './dir/c/file-c-c.mjs'],
							],
							'./d': [
								[['default'], './dir/d/file-d-d.mjs'],
							],
						});

						await fixture.rm();
					});

					test('file with star in name', async () => {
						const {
							fixture,
							assertSubpath,
							packagePath,
						} = await createPackage({
							pkg: {
								'package.json': createPkgJson({
									exports: {
										'.': './file-*.js',
										'./*': './file-*.js',
									},
								}),
								'file-*.js': 'module.exports = 123',
							},
						});

						await expect(() => assertSubpath('pkg/a', [])).rejects.toThrowError('ERR_MODULE_NOT_FOUND');
						expect(await assertSubpath('pkg/*', [])).toMatch('/file-*.js');

						const packageExports = await getPackageEntryPoints(packagePath);
						expect(packageExports).toStrictEqual({
							'.': [
								[['default'], './file-*.js'],
							],
							'./*': [
								[['default'], './file-*.js'],
							],
						});

						await fixture.rm();
					});
				});

				describe('wildcard -> static path', ({ test }) => {
					test('replace with underscore', async () => {
						const {
							fixture,
							assertSubpath,
							packagePath,
						} = await createPackage({
							pkg: {
								'package.json': createPkgJson({
									exports: {
										'./whatever*.whatever': './b/file-b.mjs',
									},
								}),
								'a/file-a.mjs': 'export default 123',
								'b/file-b.mjs': 'export default 123',
								'c/file-c.mjs': 'export default 123',
								'd/file-d.mjs': 'export default 123',
							},
						});

						await assertSubpath('pkg/whatever_.whatever', []);

						const packageExports = await getPackageEntryPoints(packagePath);
						expect(packageExports).toStrictEqual({

							'./whatever_.whatever': [
								[['default'], './b/file-b.mjs'],
							],
						});

						await fixture.rm();
					});
				});
			});
		});
	}
});
