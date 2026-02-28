import { describe, test, expect } from 'manten';
import { createPackage, createPackageJson, testScenarios } from '../utils.js';

for (const { scenario, getPackageEntryPoints } of testScenarios) {
	describe(scenario, () => {
		describe('exports =', () => {
			test('string', async () => {
				await using pkg = await createPackage({
					pkg: {
						'package.json': createPackageJson({
							exports: './file.mjs',
						}),
						'file.mjs': 'export default 123',
					},
				});

				await pkg.assertSubpath('pkg', []);

				const packageExports = await getPackageEntryPoints(pkg.packagePath);
				expect(packageExports).toStrictEqual({
					'.': [
						[['default'], './file.mjs'],
					],
				});
			});

			test('empty object', async () => {
				await using pkg = await createPackage({
					pkg: {
						'package.json': createPackageJson({
							exports: {},
						}),
						'file.mjs': 'export default 123',
					},
				});

				const packageExports = await getPackageEntryPoints(pkg.packagePath);
				expect(packageExports).toStrictEqual({});
			});

			test('null', async () => {
				await using pkg = await createPackage({
					pkg: {
						'package.json': createPackageJson({
							exports: null,
						}),
						'file.mjs': 'export default 123',
					},
				});

				await expect(() => pkg.assertSubpath('pkg', [])).rejects.toThrow('ERR_MODULE_NOT_FOUND');

				const packageExports = await getPackageEntryPoints(pkg.packagePath);
				expect(packageExports).toStrictEqual({});
			});

			describe('conditions object', () => {
				test('deeply nested conditions (5 levels)', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: {
									a: {
										b: {
											c: {
												d: {
													e: './file.mjs',
												},
											},
										},
									},
								},
							}),
							'file.mjs': 'export default 123',
						},
					});

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({
						'.': [
							[['a', 'b', 'c', 'd', 'e'], './file.mjs'],
						],
					});
				});

				test('conditions object', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: {
									conditionA: './file.mjs',
									'condition-b': './file.mjs',
								},
							}),
							'file.mjs': 'export default 123',
						},
					});

					await pkg.assertSubpath('pkg', ['conditionA']);
					await pkg.assertSubpath('pkg', ['condition-b']);

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({
						'.': [
							[['conditionA'], './file.mjs'],
							[['condition-b'], './file.mjs'],
						],

					});
				});

				test('conditions containing arrays', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: {
									conditionA: [
										'protocol:./file-a.mjs',
										{ conditionB: './file-b.mjs' },
										'./file-a.mjs',
									],
									'condition-b': [
										{ conditionC: './file-a.mjs' },
										{ conditionA: './file-a.mjs' },
									],
								},
							}),
							'file-a.mjs': 'export default 123',
							'file-b.mjs': 'export default 123',
						},
					});

					await pkg.assertSubpath('pkg', ['conditionA']);
					await pkg.assertSubpath('pkg', ['condition-b', 'conditionC']);
					await pkg.assertSubpath('pkg', ['condition-b', 'conditionA']);

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({
						'.': [
							[['conditionA'], './file-a.mjs'],
							[['conditionA', 'conditionB'], './file-b.mjs'],
							[['condition-b', 'conditionC'], './file-a.mjs'],
							[['condition-b', 'conditionA'], './file-a.mjs'],
						],
					});
				});
			});

			describe('fallback array', () => {
				test('all entries are protocol strings', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: {
									'.': [
										'protocol:./file-a.mjs',
										'another-protocol:./file-b.mjs',
									],
								},
							}),
							'file-a.mjs': 'export default 123',
							'file-b.mjs': 'export default 123',
						},
					});

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({});
				});

				test('protocol string with valid fallback', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: {
									'.': [
										'protocol:./file-b.mjs',
										'./file-a.mjs',
									],
								},
							}),
							'file-a.mjs': 'export default 123',
							'file-b.mjs': 'export default 123',
						},
					});

					expect(await pkg.assertSubpath('pkg', [])).toMatch('/file-a.mjs');

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({
						'.': [
							[['default'], './file-a.mjs'],
						],
					});
				});

				test('all files in fallback array are missing', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: {
									'.': [
										'./missing1.mjs',
										'./missing2.mjs',
										'./missing3.mjs',
									],
								},
							}),
						},
					});

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({});
				});

				test('strings', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: {
									'.': [
										'./file-b.mjs',
										'./file-a.mjs',
									],
								},
							}),
							'file-a.mjs': 'export default 123',
							'file-b.mjs': 'export default 123',
						},
					});

					expect(await pkg.assertSubpath('pkg', [])).toMatch('/file-b.mjs');

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({
						'.': [
							[['default'], './file-b.mjs'],
						],
					});
				});

				test('conditions', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: {
									'.': [
										{
											b: './file-b.mjs',
											default: null,
										},
										{
											a: './file-a.mjs',
										},
									],
								},
							}),
							'file-a.mjs': 'export default 123',
							'file-b.mjs': 'export default 123',
						},
					});

					// Note: fallback array supports conditions because its statically analyzable
					expect(await pkg.assertSubpath('pkg', ['a'])).toMatch('/file-a.mjs');
					expect(await pkg.assertSubpath('pkg', ['b'])).toMatch('/file-b.mjs');
					await expect(() => pkg.assertSubpath('pkg', [])).rejects.toThrow('ERR_PACKAGE_PATH_NOT_EXPORTED');

					const packageExports = await getPackageEntryPoints(pkg.packagePath);
					expect(packageExports).toStrictEqual({
						'.': [
							[['b'], './file-b.mjs'],
							[['a'], './file-a.mjs'],
						],
					});
				});
			});
		});
	});
}
