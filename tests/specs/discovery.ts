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
			});
		});
	}

	/**
	 * The public `fs` parameter must remain a supported injection point — Phase 2
	 * changes which fs calls happen, so lock that a custom fs is used and works.
	 */
	describe('custom fs', ({ test }) => {
		test('async uses the provided fs', async () => {
			await using pkg = await createPackage({
				pkg: {
					'package.json': createPackageJson({ exports: './a.mjs' }),
					'a.mjs': 'export default 1',
				},
			});

			const calls = {
				readFile: 0,
				readdir: 0,
			};
			const customFs = {
				readFile: (...args: Parameters<typeof fs.promises.readFile>) => {
					calls.readFile += 1;
					return fs.promises.readFile(...args);
				},
				readdir: (...args: Parameters<typeof fs.promises.readdir>) => {
					calls.readdir += 1;
					return fs.promises.readdir(...args);
				},
			} as unknown as typeof fs.promises;

			const result = await getPackageEntryPoints(pkg.packagePath, customFs);
			expect(calls.readFile).toBeGreaterThan(0);
			expect(calls.readdir).toBeGreaterThan(0);
			expect(result).toStrictEqual({
				'.': [[['default'], './a.mjs']],
			});
		});

		test('sync uses the provided fs', async () => {
			await using pkg = await createPackage({
				pkg: {
					'package.json': createPackageJson({ exports: './a.mjs' }),
					'a.mjs': 'export default 1',
				},
			});

			const calls = {
				readFileSync: 0,
				readdirSync: 0,
			};
			const customFs = {
				readFileSync: (...args: Parameters<typeof fs.readFileSync>) => {
					calls.readFileSync += 1;
					return fs.readFileSync(...args);
				},
				readdirSync: (...args: Parameters<typeof fs.readdirSync>) => {
					calls.readdirSync += 1;
					return fs.readdirSync(...args);
				},
			} as unknown as typeof fs;

			const result = getPackageEntryPointsSync(pkg.packagePath, customFs);
			expect(calls.readFileSync).toBeGreaterThan(0);
			expect(calls.readdirSync).toBeGreaterThan(0);
			expect(result).toStrictEqual({
				'.': [[['default'], './a.mjs']],
			});
		});
	});
});
