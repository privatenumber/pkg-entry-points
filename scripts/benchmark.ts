import type nodeFs from 'node:fs';
import {
	run, bench, summary, boxplot, do_not_optimize as doNotOptimize,
} from 'mitata';
import type { PackageJson } from 'type-fest';
import { getPackageEntryPointsSync } from '#pkg-entry-points';

/**
 * Benchmark the analysis path with an in-memory file system.
 *
 * `getPackageEntryPoints` is dominated by one `readdir` syscall whose cost is
 * the OS's, not ours. To measure what this library actually computes — and to
 * get low-variance numbers comparable across branches — we inject a
 * deterministic `fs` (a feature the public API already supports) instead of
 * touching disk. This exercises the full `readFile -> readdir -> collectFiles
 * -> analyzeExports` path with zero I/O noise.
 *
 * A real-filesystem benchmark belongs with the change that optimizes the walk
 * itself; this one tracks the in-memory analysis.
 */

type Manifest = {
	name?: string;
	main?: string;
	exports?: PackageJson.Exports;
};

const root = '/pkg';

const createFs = (
	manifest: Manifest,
	files: string[],
) => {
	const manifestString = JSON.stringify(manifest);
	const dirents = files.map((relativePath) => {
		const slash = relativePath.lastIndexOf('/');
		return {
			name: slash === -1 ? relativePath : relativePath.slice(slash + 1),
			parentPath: slash === -1 ? root : `${root}/${relativePath.slice(0, slash)}`,
			isFile: () => true,
		};
	});

	return {
		readFileSync: () => manifestString,
		readdirSync: () => dirents,
	} as unknown as typeof nodeFs;
};

const exportsFs = (
	exports: PackageJson.Exports,
	files: string[],
) => createFs(
	{
		name: 'pkg',
		exports,
	},
	files,
);

const distFiles = (count: number) => {
	const extensions = ['js', 'mjs', 'd.ts'];
	const files = ['index.js', 'index.mjs', 'index.d.ts'];
	for (let i = 0; i < count; i += 1) {
		files.push(`dist/feature-${i % 20}/mod-${i}.${extensions[i % 3]}`);
	}
	return files;
};

const rootEntry = {
	types: './index.d.ts',
	import: './index.mjs',
	require: './index.js',
};

const starEntry = {
	types: './dist/*.d.ts',
	import: './dist/*.mjs',
	require: './dist/*.js',
};

const wildcardExports: PackageJson.Exports = {
	'.': rootEntry,
	'./*': starEntry,
};

const wildcardWithBlocks = () => {
	const exportsMap: Record<string, unknown> = {
		'.': rootEntry,
		'./*': starEntry,
	};
	for (let i = 0; i < 16; i += 1) {
		exportsMap[`./internal-${i}/*`] = null;
	}
	return exportsMap as PackageJson.Exports;
};

const explicitConditions = () => {
	const exportsMap: Record<string, unknown> = {
		'.': rootEntry,
	};
	for (let i = 0; i < 16; i += 1) {
		exportsMap[`./feature-${i}`] = {
			node: {
				import: './index.mjs',
				require: './index.js',
			},
			browser: ['./index.mjs', './index.js'],
			default: './index.js',
		};
	}
	return exportsMap as PackageJson.Exports;
};

const legacyFiles = (count: number) => {
	const files = distFiles(count);
	files.push('LICENSE', 'README.md', 'index.js.map');
	return files;
};

const legacyManifest: Manifest = {
	name: 'pkg',
	main: './index.js',
};

// File systems are built once, up front, so only the analysis itself is timed.
const scaling = [256, 1024, 4096].map(count => ({
	count,
	fs: exportsFs(wildcardExports, distFiles(count)),
}));

const scenarios = [
	{
		name: 'wildcard exports',
		fs: exportsFs(wildcardExports, distFiles(1024)),
	},
	{
		name: 'wildcard exports + null blocks',
		fs: exportsFs(wildcardWithBlocks(), distFiles(1024)),
	},
	{
		name: 'explicit subpaths + conditions',
		fs: exportsFs(explicitConditions(), distFiles(64)),
	},
	{
		name: 'legacy (no exports field)',
		fs: createFs(legacyManifest, legacyFiles(1024)),
	},
];

const measure = (fs: typeof nodeFs) => doNotOptimize(getPackageEntryPointsSync(root, fs));

boxplot(() => {
	for (const { count, fs } of scaling) {
		bench(`wildcard exports · ${count} files`, () => measure(fs));
	}
});

summary(() => {
	for (const { name, fs } of scenarios) {
		bench(name, () => measure(fs));
	}
});

// `throw: true` so a broken benchmark (e.g. the fake fs drifting from the real
// API) fails the command instead of silently reporting success.
run({ throw: true }).catch((error: unknown) => {
	process.exitCode = 1;
	throw error;
});
