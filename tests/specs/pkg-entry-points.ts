import { describe, test, expect } from 'manten';
import { createPackage, createPackageJson, testScenarios } from '../utils.js';

for (const { scenario, getPackageEntryPoints } of testScenarios) {
	describe(scenario, () => {
		describe('pkg-entry-points', () => {
			test('missing files', async () => {
				await using pkg = await createPackage({
					pkg: {
						'package.json': createPackageJson({
							exports: './file.js',
						}),
					},
				});

				const packageExports = await getPackageEntryPoints(pkg.packagePath);
				expect(packageExports).toStrictEqual({});
			});

			test('missing files in star to star', async () => {
				await using pkg = await createPackage({
					pkg: {
						'package.json': createPackageJson({
							exports: {
								'./*': './*.js',
							},
						}),
					},
				});

				const packageExports = await getPackageEntryPoints(pkg.packagePath);
				expect(packageExports).toStrictEqual({});
			});

			test('missing files in star to static', async () => {
				await using pkg = await createPackage({
					pkg: {
						'package.json': createPackageJson({
							exports: {
								'./*': './a.js',
							},
						}),
					},
				});

				const packageExports = await getPackageEntryPoints(pkg.packagePath);
				expect(packageExports).toStrictEqual({});
			});

			test('handles fallback conditions', async () => {
				await using pkg = await createPackage({
					pkg: {
						'package.json': createPackageJson({
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

				expect(await pkg.assertSubpath('pkg', ['a'])).toMatch('/a.mjs');
				expect(await pkg.assertSubpath('pkg', ['b'])).toMatch('/b.mjs');
				await expect(() => pkg.assertSubpath('pkg', [])).rejects.toThrow('ERR_PACKAGE_PATH_NOT_EXPORTED');

				const packageExports = await getPackageEntryPoints(pkg.packagePath);
				expect(packageExports).toStrictEqual({
					'.': [
						[['b'], './b.mjs'],
						[['a'], './a.mjs'],
					],
				});
			});

			describe('stars', () => {
				test('empty star match in pattern', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: {
									'./prefix*.suffix': './prefix*.suffix',
								},
							}),
							'prefix.suffix': 'module.exports = 123',
							'prefixa.suffix': 'module.exports = 123',
						},
					});

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({
						'./prefix.suffix': [
							[['default'], './prefix.suffix'],
						],
						'./prefixa.suffix': [
							[['default'], './prefixa.suffix'],
						],
					});
				});

				test('star with no suffix', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: {
									'./feature/*': './feature/*',
								},
							}),
							feature: {
								'file-a.js': 'module.exports = 123',
							},
						},
					});

					await pkg.assertSubpath('pkg/feature/file-a.js', []);

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({
						'./feature/file-a.js': [
							[['default'], './feature/file-a.js'],
						],
					});
				});

				test('exports = multi path - conditions object', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
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

					await pkg.assertSubpath('pkg', ['conditionA']);
					await pkg.assertSubpath('pkg', ['condition-b', 'conditionC']);
					await pkg.assertSubpath('pkg/subpath', ['condition-d']);
					await pkg.assertSubpath('pkg/subpath', ['condition-e']);
					await pkg.assertSubpath('pkg/subpath', ['condition-e', 'conditionA']);
					await pkg.assertSubpath('pkg/subpath', ['condition-e', 'conditionB']);

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
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
				});

				// Pointless test?
				test('replace stars', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
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

					await pkg.assertSubpath('pkg/a', []);

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
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
				});

				test('multiple patterns matching same file', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: {
									'./dist/*.js': './dist/*.js',
									'./dist/*': './dist/*',
								},
							}),
							dist: {
								'file.js': 'module.exports = 123',
								'other.mjs': 'export default 456',
							},
						},
					});

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({
						'./dist/file.js': [
							[['default'], './dist/file.js'],
						],
						'./dist/other.mjs': [
							[['default'], './dist/other.mjs'],
						],
					});
				});

				test('file with star in name', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: {
									'.': './file-*.js',
									'./*': './file-*.js',
								},
							}),
							'file-*.js': 'module.exports = 123',
						},
					});

					await expect(() => pkg.assertSubpath('pkg/a', [])).rejects.toThrow('ERR_MODULE_NOT_FOUND');
					expect(await pkg.assertSubpath('pkg/*', [])).toMatch('/file-*.js');

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({
						'.': [
							[['default'], './file-*.js'],
						],
						'./*': [
							[['default'], './file-*.js'],
						],
					});
				});
			});

			describe('wildcard -> static path', () => {
				test('replace with underscore', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
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

					await pkg.assertSubpath('pkg/whatever_.whatever', []);

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({

						'./whatever_.whatever': [
							[['default'], './b/file-b.mjs'],
						],
					});
				});
			});
		});
	});
}
