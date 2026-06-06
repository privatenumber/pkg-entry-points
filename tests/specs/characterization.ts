import fs from 'fs';
import { fileURLToPath } from 'url';
import { testSuite, expect } from 'manten';
import type { FileTree } from 'fs-fixture';
import { createPackage, createPackageJson } from '../utils.js';
import { getPackageEntryPoints, getPackageEntryPointsSync } from '#pkg-entry-points';

type PackageEntryPoints = ReturnType<typeof getPackageEntryPointsSync>;

/**
 * Broad golden-snapshot net for `getPackageEntryPoints`.
 *
 * Runs many exports/legacy shapes on real fixtures and pins the (normalized)
 * output to a committed JSON. This complements the focused unit specs: any
 * unexpected output change from the planned discovery rewrite (Phase 2) shows
 * up as a diff here. Subpath-key order is normalized away (not contractual);
 * each entry's condition order is preserved (it is meaningful).
 *
 * Regenerate after an intentional change: `UPDATE_SNAPSHOT=1 pnpm test`
 * (run with `--conditions=development` locally, e.g. via `pnpm dev`-style).
 */

const snapshotPath = fileURLToPath(new URL('../characterization-snapshot.json', import.meta.url));
const updateSnapshot = process.env.UPDATE_SNAPSHOT === '1';

const normalize = (
	result: PackageEntryPoints,
) => Object.fromEntries(
	Object.keys(result).toSorted().map(subpath => [subpath, result[subpath]]),
);

const cases: {
	name: string;
	files: FileTree;
}[] = [
	{
		name: 'exports: string',
		files: {
			'package.json': createPackageJson({ exports: './index.mjs' }),
			'index.mjs': '',
		},
	},
	{
		name: 'exports: null',
		files: {
			'package.json': createPackageJson({ exports: null }),
			'index.mjs': '',
		},
	},
	{
		name: 'exports: empty object',
		files: {
			'package.json': createPackageJson({ exports: {} }),
			'index.mjs': '',
		},
	},
	{
		name: 'exports: conditions object (no subpath keys)',
		files: {
			'package.json': createPackageJson({
				exports: {
					types: './index.d.ts',
					import: './index.mjs',
					require: './index.cjs',
				},
			}),
			'index.d.ts': '',
			'index.mjs': '',
			'index.cjs': '',
		},
	},
	{
		name: 'exports: nested conditions',
		files: {
			'package.json': createPackageJson({
				exports: {
					node: {
						import: './node.mjs',
						require: './node.cjs',
					},
					default: './default.mjs',
				},
			}),
			'node.mjs': '',
			'node.cjs': '',
			'default.mjs': '',
		},
	},
	{
		name: 'exports: subpaths with conditions',
		files: {
			'package.json': createPackageJson({
				exports: {
					'.': {
						import: './index.mjs',
						require: './index.cjs',
					},
					'./feature': {
						import: './feature.mjs',
						require: './feature.cjs',
					},
				},
			}),
			'index.mjs': '',
			'index.cjs': '',
			'feature.mjs': '',
			'feature.cjs': '',
		},
	},
	{
		name: 'exports: fallback array of strings',
		files: {
			'package.json': createPackageJson({
				exports: { '.': ['./first.mjs', './second.mjs'] },
			}),
			'first.mjs': '',
			'second.mjs': '',
		},
	},
	{
		name: 'exports: fallback array with protocol',
		files: {
			'package.json': createPackageJson({
				exports: { '.': ['protocol:./x.mjs', './real.mjs'] },
			}),
			'real.mjs': '',
		},
	},
	{
		name: 'exports: wildcard',
		files: {
			'package.json': createPackageJson({
				exports: { './*': './dist/*.mjs' },
			}),
			'dist/a.mjs': '',
			'dist/nested/b.mjs': '',
		},
	},
	{
		name: 'exports: wildcard with conditions',
		files: {
			'package.json': createPackageJson({
				exports: {
					'.': {
						types: './index.d.ts',
						import: './index.mjs',
					},
					'./*': {
						types: './dist/*.d.ts',
						import: './dist/*.mjs',
					},
				},
			}),
			'index.d.ts': '',
			'index.mjs': '',
			'dist/a.d.ts': '',
			'dist/a.mjs': '',
		},
	},
	{
		name: 'exports: multi-star value',
		files: {
			'package.json': createPackageJson({
				exports: { './*': './dir/*/file-*.mjs' },
			}),
			'dir/a/file-a.mjs': '',
			'dir/b/file-b.mjs': '',
		},
	},
	{
		name: 'exports: wildcard to static (underscore)',
		files: {
			'package.json': createPackageJson({
				exports: { './prefix*.suffix': './target.mjs' },
			}),
			'target.mjs': '',
		},
	},
	{
		name: 'exports: null block (exact)',
		files: {
			'package.json': createPackageJson({
				exports: {
					'./private': null,
					'./*': './*.mjs',
				},
			}),
			'private.mjs': '',
			'public.mjs': '',
		},
	},
	{
		name: 'exports: null block (star)',
		files: {
			'package.json': createPackageJson({
				exports: {
					'./*.js': './*.js',
					'./internal/*': null,
				},
			}),
			'public.js': '',
			'internal/secret.js': '',
		},
	},
	{
		name: 'legacy: with main',
		files: {
			'package.json': createPackageJson({ main: './lib/main.js' }),
			'lib/main.js': '',
			'lib/other.js': '',
			'data.json': '',
			'types.d.ts': '',
			'README.md': '',
		},
	},
	{
		name: 'legacy: no main (index.js)',
		files: {
			'package.json': createPackageJson({}),
			'index.js': '',
			'helper.mjs': '',
		},
	},
	{
		name: 'legacy: invalid main',
		files: {
			'package.json': createPackageJson({ main: './missing.js' }),
			'index.js': '',
		},
	},
	{
		name: 'vue-like (subset)',
		files: {
			'package.json': createPackageJson({
				exports: {
					'.': {
						types: './dist/vue.d.ts',
						import: './index.mjs',
						require: './index.js',
					},
					'./server-renderer': {
						import: './server-renderer/index.mjs',
						require: './server-renderer/index.js',
					},
					'./package.json': './package.json',
					'./dist/*': './dist/*',
				},
			}),
			'dist/vue.d.ts': '',
			'dist/vue.cjs.js': '',
			'index.mjs': '',
			'index.js': '',
			'server-renderer/index.mjs': '',
			'server-renderer/index.js': '',
		},
	},
];

export default testSuite(({ describe }) => {
	const golden: Record<string, unknown> = (
		updateSnapshot
			? {}
			: JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
	);
	const collected: Record<string, unknown> = {};

	describe('characterization', ({ test, onFinish }) => {
		for (const testCase of cases) {
			test(testCase.name, async () => {
				await using pkg = await createPackage({ pkg: testCase.files });

				const asyncResult = normalize(await getPackageEntryPoints(pkg.packagePath));
				const syncResult = normalize(getPackageEntryPointsSync(pkg.packagePath));

				// sync and async must agree
				expect(syncResult).toStrictEqual(asyncResult);

				if (updateSnapshot) {
					collected[testCase.name] = asyncResult;
				} else {
					expect(asyncResult).toStrictEqual(golden[testCase.name]);
				}
			});
		}

		onFinish(() => {
			if (updateSnapshot) {
				fs.writeFileSync(snapshotPath, `${JSON.stringify(collected, null, '\t')}\n`);
			}
		});
	});
});
