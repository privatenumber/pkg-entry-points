import { testSuite, expect } from 'manten';
import { createPackage, createPkgJson } from '../utils.js';

export default testSuite(({ describe }) => {
	describe('Node.js resolve behavior', ({ test }) => {
		test('Allows any character as condition', async () => {
			const condition = '\\∑´®¥|,.-=_!@#$%^&*()"12\r345\n67890œ∑´®†¥¨ˆøπ“‘åß∂ƒ©˙∆˚¬…æ≈ç√∫˜µ≤≥÷';
			const {
				fixture,
				assertSubpath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						exports: {
							'.': {
								[condition]: './file.mjs',
							},
						},
					}),
					'file.mjs': 'export default 123',
				},
			});

			expect(await assertSubpath('pkg', [condition])).toMatch('file.mjs');

			await fixture.rm();
		});

		// It has a prioritzation algorithm
		test('Does not merge overlapping entries', async () => {
			const {
				fixture,
				assertSubpath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						exports: {
							'./a': {
								someCondition: './b/import.mjs',
							},
							'./*': './a/*.mjs',
						},
					}),
					'a/a.mjs': 'export default 123',
					'b/import.mjs': 'export default 123',
				},
			});

			// If they merged, this should resolve to `./a/a.mjs`
			await expect(() => assertSubpath('pkg/a', [])).rejects.toThrow('ERR_PACKAGE_PATH_NOT_EXPORTED');

			await fixture.rm();
		});

		test('follows order of exports', async () => {
			const {
				fixture,
				assertSubpath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						exports: {
							'.': {
								a: {
									b: './file-a.mjs',
								},
								b: {
									a: './file-b.mjs',
								},
							},
						},
					}),
					'file-a.mjs': 'export default 123',
					'file-b.mjs': 'export default 123',
				},
			});

			expect(await assertSubpath('pkg', ['a', 'b'])).toMatch('file-a.mjs');
			expect(await assertSubpath('pkg', ['b', 'a'])).toMatch('file-a.mjs');

			await fixture.rm();
		});

		test('blocks path', async () => {
			const {
				fixture,
				assertSubpath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						exports: {
							'./*': './lib/*.mjs',
							'./a': null,
						},
					}),
					lib: {
						'a.mjs': 'export default 123',
						'b.mjs': 'export default 123',
					},
				},
			});

			expect(await assertSubpath('pkg/b', [])).toMatch('/lib/b.mjs');
			await expect(() => assertSubpath('pkg/a', [])).rejects.toThrowError('ERR_PACKAGE_PATH_NOT_EXPORTED');

			await fixture.rm();
		});

		test('blocks path with condition', async () => {
			const {
				fixture,
				assertSubpath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						exports: {
							'./*': './lib/*.mjs',
							'./a': {
								a: null,
								default: './lib/a.mjs',
							},
						},
					}),
					lib: {
						'a.mjs': 'export default 123',
						'b.mjs': 'export default 123',
					},
				},
			});

			expect(await assertSubpath('pkg/a', [])).toMatch('/lib/a.mjs');
			expect(await assertSubpath('pkg/b', [])).toMatch('/lib/b.mjs');
			await expect(() => assertSubpath('pkg/a', ['a'])).rejects.toThrowError('ERR_PACKAGE_PATH_NOT_EXPORTED');

			await fixture.rm();
		});

		test('null in array doesnt block path', async () => {
			const {
				fixture,
				assertSubpath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						// @ts-expect-error invalid exports
						exports: {
							'.': [
								null,
								null,
								null,
								null,
								'./file.mjs',
								null,
							],
						},
					}),
					'file.mjs': 'export default 123',
				},
			});

			expect(await assertSubpath('pkg', [])).toMatch('/file.mjs');

			await fixture.rm();
		});

		test('Target cannot start with *', async () => {
			const {
				fixture,
				assertSubpath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						exports: {
							'./*': '*.mjs',
						},
					}),
					'a.mjs': 'export default 123',
				},
			});

			// If they merged, this should resolve to `./a/a.mjs`
			await expect(() => assertSubpath('pkg/a', [])).rejects.toThrow('targets must start with "./"');

			await fixture.rm();
		});

		test('Matches file with * in name', async () => {
			const {
				fixture,
				assertSubpath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						exports: {
							'.': './a*.mjs',
						},
					}),
					'a*.mjs': 'export default 123',
				},
			});

			expect(await assertSubpath('pkg', [])).toMatch('a*.mjs');

			await fixture.rm();
		});

		test('Doesnt match file with * in name', async () => {
			const {
				fixture,
				assertSubpath,
			} = await createPackage({
				pkg: {
					'package.json': createPkgJson({
						exports: {
							'./*': './a*.mjs',
						},
					}),
					'a*.mjs': 'export default 123',
				},
			});

			await expect(() => assertSubpath('pkg/a', ['a'])).rejects.toThrowError('ERR_MODULE_NOT_FOUND');

			await fixture.rm();
		});
	});
});
