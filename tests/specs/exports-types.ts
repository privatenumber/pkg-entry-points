import { testSuite, expect } from 'manten';
import { createPackage, createPkgJson, testScenarios } from '../utils.js';

export default testSuite(({ describe }) => {
	for (const { scenario, getPackageEntryPoints } of testScenarios) {
		describe(scenario, ({ describe }) => {
			describe('exports =', ({ test, describe }) => {
				test('string', async () => {
					const {
						fixture,
						packagePath,
						assertSubpath,
					} = await createPackage({
						pkg: {
							'package.json': createPkgJson({
								exports: './file.mjs',
							}),
							'file.mjs': 'export default 123',
						},
					});

					await assertSubpath('pkg', []);

					const packageExports = await getPackageEntryPoints(packagePath);
					expect(packageExports).toStrictEqual({
						'.': [
							[['default'], './file.mjs'],
						],
					});

					await fixture.rm();
				});

				test('null', async () => {
					const {
						fixture,
						packagePath,
						assertSubpath,
					} = await createPackage({
						pkg: {
							'package.json': createPkgJson({
								exports: null,
							}),
							'file.mjs': 'export default 123',
						},
					});

					await expect(() => assertSubpath('pkg', [])).rejects.toThrowError('ERR_MODULE_NOT_FOUND');

					const packageExports = await getPackageEntryPoints(packagePath);
					expect(packageExports).toStrictEqual({});

					await fixture.rm();
				});

				describe('conditions object', ({ test }) => {
					test('conditions object', async () => {
						const {
							fixture,
							packagePath,
							assertSubpath,
						} = await createPackage({
							pkg: {
								'package.json': createPkgJson({
									exports: {
										conditionA: './file.mjs',
										'condition-b': './file.mjs',
									},
								}),
								'file.mjs': 'export default 123',
							},
						});

						await assertSubpath('pkg', ['conditionA']);
						await assertSubpath('pkg', ['condition-b']);

						const packageExports = await getPackageEntryPoints(packagePath);
						expect(packageExports).toStrictEqual({
							'.': [
								[['conditionA'], './file.mjs'],
								[['condition-b'], './file.mjs'],
							],

						});

						await fixture.rm();
					});

					test('conditions containing arrays', async () => {
						const {
							fixture,
							packagePath,
							assertSubpath,
						} = await createPackage({
							pkg: {
								'package.json': createPkgJson({
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

						await assertSubpath('pkg', ['conditionA']);
						await assertSubpath('pkg', ['condition-b', 'conditionC']);
						await assertSubpath('pkg', ['condition-b', 'conditionA']);

						const packageExports = await getPackageEntryPoints(packagePath);
						expect(packageExports).toStrictEqual({
							'.': [
								[['conditionA'], './file-a.mjs'],
								[['conditionA', 'conditionB'], './file-b.mjs'],
								[['condition-b', 'conditionC'], './file-a.mjs'],
								[['condition-b', 'conditionA'], './file-a.mjs'],
							],
						});

						await fixture.rm();
					});
				});

				describe('fallback array', ({ test }) => {
					test('strings', async () => {
						const {
							fixture,
							packagePath,
							assertSubpath,
						} = await createPackage({
							pkg: {
								'package.json': createPkgJson({
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

						expect(await assertSubpath('pkg', [])).toMatch('/file-b.mjs');

						const packageExports = await getPackageEntryPoints(packagePath);
						expect(packageExports).toStrictEqual({
							'.': [
								[['default'], './file-b.mjs'],
							],
						});

						await fixture.rm();
					});

					test('conditions', async () => {
						const {
							fixture,
							packagePath,
							assertSubpath,
						} = await createPackage({
							pkg: {
								'package.json': createPkgJson({
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
						expect(await assertSubpath('pkg', ['a'])).toMatch('/file-a.mjs');
						expect(await assertSubpath('pkg', ['b'])).toMatch('/file-b.mjs');
						await expect(() => assertSubpath('pkg', [])).rejects.toThrowError('ERR_PACKAGE_PATH_NOT_EXPORTED');

						const packageExports = await getPackageEntryPoints(packagePath);
						expect(packageExports).toStrictEqual({
							'.': [
								[['b'], './file-b.mjs'],
								[['a'], './file-a.mjs'],
							],
						});

						await fixture.rm();
					});
				});
			});
		});
	}
});
