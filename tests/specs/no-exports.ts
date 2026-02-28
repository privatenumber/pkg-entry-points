import { describe, test, expect } from 'manten';
import { createPackage, createPackageJson, testScenarios } from '../utils.js';

for (const { scenario, getPackageEntryPoints } of testScenarios) {
	describe(scenario, () => {
		describe('no exports', () => {
			test('no exports should list all files', async () => {
				await using pkg = await createPackage({
					pkg: {
						'package.json': createPackageJson({
							main: './main.mjs',
						}),
						'README.md': 'hello',
						'main.mjs': 'export default 123',
						'a.mjs': 'export default 123',
						'directory/b.mjs': 'export default 123',
						'types.d.ts': 'const a: number; export default a',
					},
				});

				await pkg.assertSubpath('pkg/a.mjs', []);

				const packageExports = await getPackageEntryPoints(pkg.packagePath);
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
					'./types.d.ts': [[['default'], './types.d.ts']],
				});
			});

			test('no main should fallback to index.js', async () => {
				await using pkg = await createPackage({
					pkg: {
						'package.json': createPackageJson({}),
						'index.js': 'module.exports = 123',
					},
				});

				await pkg.assertSubpath('pkg', []);

				const packageExports = await getPackageEntryPoints(pkg.packagePath);
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
			});

			test('invalid main', async () => {
				await using pkg = await createPackage({
					pkg: {
						'package.json': createPackageJson({
							main: './missing-file.js',
						}),
						'index.js': 'module.exports = 123',
					},
				});

				await pkg.assertSubpath('pkg', []);

				const packageExports = await getPackageEntryPoints(pkg.packagePath);
				expect(packageExports).toStrictEqual({
					'./index.js': [
						[['default'], './index.js'],
					],
					'./package.json': [
						[['default'], './package.json'],
					],
				});
			});

			test('includes hidden files', async () => {
				await using pkg = await createPackage({
					pkg: {
						'package.json': createPackageJson({
							main: './index.js',
						}),
						'index.js': 'module.exports = 123',
						'.gitignore': 'node_modules',
						'.npmrc': 'registry=https://registry.npmjs.org',
						'.hidden.js': 'module.exports = 456',
					},
				});

				const packageExports = await getPackageEntryPoints(pkg.packagePath);
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
					'./.hidden.js': [
						[['default'], './.hidden.js'],
					],
				});
			});

			test('empty package with only package.json', async () => {
				await using pkg = await createPackage({
					pkg: {
						'package.json': createPackageJson({}),
					},
				});

				const packageExports = await getPackageEntryPoints(pkg.packagePath);
				expect(packageExports).toStrictEqual({
					'./package.json': [
						[['default'], './package.json'],
					],
				});
			});

			test('should exclude node_modules subdirectory', async () => {
				await using pkg = await createPackage({
					pkg: {
						'package.json': createPackageJson({
							main: './index.js',
						}),
						'index.js': 'module.exports = 123',
						node_modules: {
							'some-dep': {
								'package.json': createPackageJson({}),
								'index.js': 'module.exports = 456',
							},
						},
					},
				});

				const packageExports = await getPackageEntryPoints(pkg.packagePath);
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
			});

			test('should only exclude root node_modules, not nested', async () => {
				await using pkg = await createPackage({
					pkg: {
						'package.json': createPackageJson({
							main: './index.js',
						}),
						'index.js': 'module.exports = 123',
						'dist/file.js': 'module.exports = 789',
						node_modules: {
							'root-dep': {
								'index.js': 'module.exports = 456',
							},
						},
						'dist/node_modules': {
							'nested-dep': {
								'index.js': 'module.exports = 999',
							},
						},
					},
				});

				const packageExports = await getPackageEntryPoints(pkg.packagePath);
				expect(packageExports).toStrictEqual({
					'.': [
						[['default'], './index.js'],
					],
					'./index.js': [
						[['default'], './index.js'],
					],
					'./dist/file.js': [
						[['default'], './dist/file.js'],
					],
					'./dist/node_modules/nested-dep/index.js': [
						[['default'], './dist/node_modules/nested-dep/index.js'],
					],
					'./package.json': [
						[['default'], './package.json'],
					],
				});
			});

			describe('extensionless main', () => {
				test('explicitly extensionless', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								main: './file',
							}),
							file: 'module.exports = 123',
							'file.js': 'module.exports = 123',
							'file.json': '{ "default": 123 }',
						},
					});

					await pkg.assertSubpath('pkg', []);

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({
						'.': [
							[['default'], './file'],
						],
						'./package.json': [
							[['default'], './package.json'],
						],
						'./file': [
							[['default'], './file'],
						],
						'./file.js': [
							[['default'], './file.js'],
						],
						'./file.json': [
							[['default'], './file.json'],
						],
					});
				});

				test('implicitly .js', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								main: './file',
							}),
							'file.js': 'module.exports = 123',
							'file.json': 'export default 123',
						},
					});

					await pkg.assertSubpath('pkg', []);

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({
						'.': [
							[['default'], './file.js'],
						],
						'./package.json': [
							[['default'], './package.json'],
						],
						'./file.js': [
							[['default'], './file.js'],
						],
						'./file.json': [
							[['default'], './file.json'],
						],
					});
				});

				test('implicitly .json', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								main: './file',
							}),
							'file.json': 'export default 123',
						},
					});

					await pkg.assertSubpath('pkg', []);

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({
						'.': [
							[['default'], './file.json'],
						],
						'./package.json': [
							[['default'], './package.json'],
						],
						'./file.json': [
							[['default'], './file.json'],
						],
					});
				});
			});
		});
	});
}
