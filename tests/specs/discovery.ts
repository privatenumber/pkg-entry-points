import fs from 'fs';
import path from 'path';
import { testSuite, expect } from 'manten';
import { createPackage, createPackageJson, testScenarios } from '../utils.js';
import { getPackageEntryPoints, getPackageEntryPointsSync } from '#pkg-entry-points';

/**
 * Characterizes the file-discovery layer (`getAllFiles` + how the analysis
 * consumes the file list). These are the behaviors most at risk from the
 * planned demand-driven discovery rewrite (Phase 2), so they're pinned here
 * before that work starts.
 */
export default testSuite(({ describe }) => {
	for (const { scenario, getPackageEntryPoints: getEntries } of testScenarios) {
		describe(scenario, ({ describe }) => {
			describe('discovery', ({ test }) => {
				test('excludes symlinked files', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({ main: './index.js' }),
							'index.js': 'module.exports = 1',
							'real.js': 'module.exports = 2',
							'link.js': ({ symlink }) => symlink('./real.js'),
						},
					});

					const result = await getEntries(pkg.packagePath);
					expect(result).toStrictEqual({
						'.': [[['default'], './index.js']],
						'./index.js': [[['default'], './index.js']],
						'./real.js': [[['default'], './real.js']],
						'./package.json': [[['default'], './package.json']],
					});
				});

				/**
				 * The manual walk skips symlinked directories (`isDirectory()` is
				 * false for a symlink) in both sync and async. This unifies a prior
				 * divergence where recursive `readdirSync` followed symlinked dirs but
				 * async `readdir` did not.
				 */
				test('does not follow symlinked directories', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({ main: './index.js' }),
							'index.js': 'module.exports = 1',
							'real/deep.js': 'module.exports = 2',
							linked: ({ symlink }) => symlink('./real', 'dir'),
						},
					});

					const result = await getEntries(pkg.packagePath);
					expect(result).toStrictEqual({
						'.': [[['default'], './index.js']],
						'./index.js': [[['default'], './index.js']],
						'./real/deep.js': [[['default'], './real/deep.js']],
						'./package.json': [[['default'], './package.json']],
					});
				});

				/**
				 * Current behavior only prunes the *root* `node_modules`. Files under a
				 * nested `node_modules` (e.g. `dist/node_modules`) ARE included and ARE
				 * matched by wildcards. Phase 2's "skip node_modules subtrees" must
				 * either preserve this or treat it as an intentional change.
				 */
				test('wildcard matches files under nested node_modules', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: { './*': './dist/*.mjs' },
							}),
							'dist/a.mjs': 'export default 1',
							'dist/node_modules/dep/index.mjs': 'export default 2',
						},
					});

					const result = await getEntries(pkg.packagePath);
					expect(result).toStrictEqual({
						'./a': [[['default'], './dist/a.mjs']],
						'./node_modules/dep/index': [[['default'], './dist/node_modules/dep/index.mjs']],
					});
				});

				test('explicit target outside any star prefix is included', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: {
									'./lib': './lib/index.mjs',
									'./*': './dist/*.mjs',
								},
							}),
							'lib/index.mjs': 'export default 1',
							'dist/a.mjs': 'export default 2',
						},
					});

					const result = await getEntries(pkg.packagePath);
					expect(result).toStrictEqual({
						'./lib': [[['default'], './lib/index.mjs']],
						'./a': [[['default'], './dist/a.mjs']],
					});
				});

				test('multiple distinct star prefixes', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: {
									'./a/*': './src-a/*.mjs',
									'./b/*': './src-b/*.mjs',
								},
							}),
							'src-a/x.mjs': 'export default 1',
							'src-b/y.mjs': 'export default 2',
						},
					});

					const result = await getEntries(pkg.packagePath);
					expect(result).toStrictEqual({
						'./a/x': [[['default'], './src-a/x.mjs']],
						'./b/y': [[['default'], './src-b/y.mjs']],
					});
				});

				test('multi-star value requires a consistent capture', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: { './*': './dir/*-*-*.mjs' },
							}),
							'dir/a-a-a.mjs': 'export default 1',
							'dir/a-b-c.mjs': 'export default 2',
						},
					});

					const result = await getEntries(pkg.packagePath);
					expect(result).toStrictEqual({
						'./a': [[['default'], './dir/a-a-a.mjs']],
					});
				});

				test('bare main without "./" prefix', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({ main: 'index.js' }),
							'index.js': 'module.exports = 1',
						},
					});

					const result = await getEntries(pkg.packagePath);
					expect(result).toStrictEqual({
						'.': [[['default'], './index.js']],
						'./index.js': [[['default'], './index.js']],
						'./package.json': [[['default'], './package.json']],
					});
				});

				test('trailing separator on packagePath', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: { './*': './dist/*.mjs' },
							}),
							'dist/a.mjs': 'export default 1',
						},
					});

					const withSeparator = await getEntries(pkg.packagePath + path.sep);
					expect(withSeparator).toStrictEqual({
						'./a': [[['default'], './dist/a.mjs']],
					});
				});

				test('trailing separator on packagePath (legacy)', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({ main: './index.js' }),
							'index.js': 'module.exports = 1',
						},
					});

					const withSeparator = await getEntries(pkg.packagePath + path.sep);
					expect(withSeparator).toStrictEqual({
						'.': [[['default'], './index.js']],
						'./index.js': [[['default'], './index.js']],
						'./package.json': [[['default'], './package.json']],
					});
				});

				test('wildcard pointing at a missing directory yields nothing', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: { './*': './missing/*.mjs' },
							}),
							'index.js': '',
						},
					});

					const result = await getEntries(pkg.packagePath);
					expect(result).toStrictEqual({});
				});

				test('does not follow a symlinked wildcard directory', async () => {
					await using pkg = await createPackage({
						pkg: {
							'package.json': createPackageJson({
								exports: { './*': './linked/*.mjs' },
							}),
							'real/a.mjs': 'export default 1',
							linked: ({ symlink }) => symlink('./real', 'dir'),
						},
					});

					const result = await getEntries(pkg.packagePath);
					expect(result).toStrictEqual({});
				});
			});
		});
	}

	/**
	 * The public `fs` parameter must remain a supported injection point — Phase 2
	 * changes which fs calls happen, so lock that a custom fs is used and works.
	 */
	describe('custom fs', ({ test }) => {
		// A Proxy delegates every method, so the test stays valid as the set of
		// fs calls evolves (e.g. discovery added `lstat`). It records which
		// methods were accessed to confirm the injected fs is actually used.
		test('async uses the provided fs', async () => {
			await using pkg = await createPackage({
				pkg: {
					'package.json': createPackageJson({ exports: { './*': './dist/*.mjs' } }),
					'dist/a.mjs': 'export default 1',
				},
			});

			const used = new Set<string>();
			const trackingFs = new Proxy(fs.promises, {
				get(target, property) {
					used.add(property.toString());
					return target[property as keyof typeof target];
				},
			});

			const result = await getPackageEntryPoints(pkg.packagePath, trackingFs);
			expect(used.has('readFile')).toBe(true);
			expect(used.has('readdir')).toBe(true);
			expect(result).toStrictEqual({
				'./a': [[['default'], './dist/a.mjs']],
			});
		});

		test('sync uses the provided fs', async () => {
			await using pkg = await createPackage({
				pkg: {
					'package.json': createPackageJson({ exports: { './*': './dist/*.mjs' } }),
					'dist/a.mjs': 'export default 1',
				},
			});

			const used = new Set<string>();
			const trackingFs = new Proxy(fs, {
				get(target, property) {
					used.add(property.toString());
					return target[property as keyof typeof target];
				},
			});

			const result = getPackageEntryPointsSync(pkg.packagePath, trackingFs);
			expect(used.has('readFileSync')).toBe(true);
			expect(used.has('readdirSync')).toBe(true);
			expect(result).toStrictEqual({
				'./a': [[['default'], './dist/a.mjs']],
			});
		});

		// A real fs error (not a missing path) must surface, not be swallowed.
		test('async surfaces non-missing fs errors', async () => {
			await using pkg = await createPackage({
				pkg: {
					'package.json': createPackageJson({ exports: './a.mjs' }),
					'a.mjs': 'export default 1',
				},
			});

			const failingFs = new Proxy(fs.promises, {
				get(target, property) {
					if (property === 'lstat') {
						return () => Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' }));
					}
					return target[property as keyof typeof target];
				},
			});

			await expect(getPackageEntryPoints(pkg.packagePath, failingFs)).rejects.toThrow('denied');
		});

		test('sync surfaces non-missing fs errors', async () => {
			await using pkg = await createPackage({
				pkg: {
					'package.json': createPackageJson({ exports: './a.mjs' }),
					'a.mjs': 'export default 1',
				},
			});

			const failingFs = new Proxy(fs, {
				get(target, property) {
					if (property === 'lstatSync') {
						return () => {
							throw Object.assign(new Error('denied'), { code: 'EACCES' });
						};
					}
					return target[property as keyof typeof target];
				},
			});

			expect(() => getPackageEntryPointsSync(pkg.packagePath, failingFs)).toThrow('denied');
		});
	});
});
