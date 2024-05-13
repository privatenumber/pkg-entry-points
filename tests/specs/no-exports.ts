import { testSuite, expect } from 'manten';
import { createPackage, createPkgJson, testScenarios } from '../utils.js';

export default testSuite(({ describe }) => {
	for (const { scenario, getPackageEntryPoints } of testScenarios) {
		describe(scenario, ({ describe }) => {
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
							'types.d.ts': 'const a: number; export default a',
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
						'./types.d.ts': [[['default'], './types.d.ts']],
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
							'index.js': 'module.exports = 123',
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
							'index.js': 'module.exports = 123',
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

				describe('extensionless main', ({ test }) => {
					test('explicitly extensionless', async () => {
						const {
							fixture,
							assertSubpath,
							packagePath,
						} = await createPackage({
							pkg: {
								'package.json': createPkgJson({
									main: './file',
								}),
								file: 'module.exports = 123',
								'file.js': 'module.exports = 123',
								'file.json': '{ "default": 123 }',
							},
						});

						await assertSubpath('pkg', []);

						const packageExports = await getPackageEntryPoints(packagePath);
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

						await fixture.rm();
					});

					test('implicitly .js', async () => {
						const {
							fixture,
							assertSubpath,
							packagePath,
						} = await createPackage({
							pkg: {
								'package.json': createPkgJson({
									main: './file',
								}),
								'file.js': 'module.exports = 123',
								'file.json': 'export default 123',
							},
						});

						await assertSubpath('pkg', []);

						const packageExports = await getPackageEntryPoints(packagePath);
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

						await fixture.rm();
					});

					test('implicitly .json', async () => {
						const {
							fixture,
							assertSubpath,
							packagePath,
						} = await createPackage({
							pkg: {
								'package.json': createPkgJson({
									main: './file',
								}),
								'file.json': 'export default 123',
							},
						});

						await assertSubpath('pkg', []);

						const packageExports = await getPackageEntryPoints(packagePath);
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

						await fixture.rm();
					});
				});
			});
		});
	}
});
