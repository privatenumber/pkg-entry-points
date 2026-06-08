import type _fs from 'fs';
import path from 'path';
import type { PackageJson } from 'type-fest';
import { STAR } from './constants.js';

const stripTrailingSeparator = (
	directoryPath: string,
) => (
	directoryPath.endsWith(path.sep)
		? directoryPath.slice(0, -1)
		: directoryPath
);

/**
 * Recursively walk a directory, pushing files as `./`-relative paths.
 *
 * Manual walk (rather than `readdir({ recursive: true })`) so we can:
 * - prune `node_modules` only at the package root, without descending into it
 *   (files under a *nested* `node_modules` are still listed, as before)
 * - skip symlinks consistently across sync and async (recursive `readdirSync`
 *   followed symlinked directories; async `readdir` did not)
 *
 * `relativePrefix` is the path from the package root to `absoluteDirectory`,
 * with a trailing separator (empty at the root). The root `node_modules` is
 * the one reached while `relativePrefix` is empty.
 */
const walkDirectory = async (
	fs: Pick<typeof _fs.promises, 'readdir'>,
	absoluteDirectory: string,
	relativePrefix: string,
	result: string[],
): Promise<void> => {
	const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory()) {
			if (relativePrefix === '' && entry.name === 'node_modules') {
				continue;
			}
			await walkDirectory(
				fs,
				`${absoluteDirectory}${path.sep}${entry.name}`,
				`${relativePrefix}${entry.name}${path.sep}`,
				result,
			);
		} else if (entry.isFile()) {
			result.push(`./${relativePrefix}${entry.name}`);
		}
	}
};

const walkDirectorySync = (
	fs: Pick<typeof _fs, 'readdirSync'>,
	absoluteDirectory: string,
	relativePrefix: string,
	result: string[],
): void => {
	const entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory()) {
			if (relativePrefix === '' && entry.name === 'node_modules') {
				continue;
			}
			walkDirectorySync(
				fs,
				`${absoluteDirectory}${path.sep}${entry.name}`,
				`${relativePrefix}${entry.name}${path.sep}`,
				result,
			);
		} else if (entry.isFile()) {
			result.push(`./${relativePrefix}${entry.name}`);
		}
	}
};

/**
 * List every file in a package as `./`-relative paths.
 *
 * Used for legacy packages (no `exports`), where every file is a potential
 * entry point so the whole tree must be scanned.
 */
export const getAllFiles = async (
	fs: Pick<typeof _fs.promises, 'readdir'>,
	directoryPath: string,
): Promise<string[]> => {
	const result: string[] = [];
	await walkDirectory(fs, stripTrailingSeparator(directoryPath), '', result);
	return result;
};

export const getAllFilesSync = (
	fs: Pick<typeof _fs, 'readdirSync'>,
	directoryPath: string,
): string[] => {
	const result: string[] = [];
	walkDirectorySync(fs, stripTrailingSeparator(directoryPath), '', result);
	return result;
};

/**
 * Collect every `./`-relative string target from an `exports` subtree.
 *
 * Only relative (`./`) targets can resolve to real files; bare/URL/protocol
 * targets and `null` are skipped. Object keys (subpaths/conditions) are not
 * targets — only values are.
 */
const collectExportTargets = (
	exportsValue: PackageJson.Exports,
	targets: Set<string>,
): void => {
	if (typeof exportsValue === 'string') {
		if (exportsValue.startsWith('./')) {
			targets.add(exportsValue);
		}
	} else if (Array.isArray(exportsValue)) {
		for (const value of exportsValue) {
			collectExportTargets(value, targets);
		}
	} else if (exportsValue && typeof exportsValue === 'object') {
		const object = exportsValue as Record<string, PackageJson.Exports>;
		for (const key in object) {
			if (Object.hasOwn(object, key)) {
				collectExportTargets(object[key], targets);
			}
		}
	}
};

/**
 * The package-relative directory a wildcard target's matches live under:
 * everything before the first `*`, up to the last separator. Empty = root.
 * (Uses only the first `*`; values may contain several, all bound to the
 * same capture, and everything before the first is a literal prefix.)
 */
const wildcardDirectory = (
	target: string,
) => {
	const literalPrefix = target.slice(0, target.indexOf(STAR));
	return literalPrefix.slice(2, literalPrefix.lastIndexOf('/'));
};

const toAbsolute = (
	packagePath: string,
	relativeDirectory: string,
) => (
	relativeDirectory
		? path.join(packagePath, relativeDirectory)
		: packagePath
);

const toRelativePrefix = (
	relativeDirectory: string,
) => (
	relativeDirectory
		? `${relativeDirectory.split('/').join(path.sep)}${path.sep}`
		: ''
);

// A path that simply isn't there. Other errors (e.g. EACCES) should surface.
const isMissing = (
	error: unknown,
) => {
	const code = (error as NodeJS.ErrnoException | null)?.code;
	return code === 'ENOENT' || code === 'ENOTDIR';
};

// `lstat` a path, returning undefined if it's absent but surfacing real errors.
const tryLstat = async (
	fs: Pick<typeof _fs.promises, 'lstat'>,
	absolutePath: string,
) => {
	try {
		return await fs.lstat(absolutePath);
	} catch (error) {
		if (!isMissing(error)) {
			throw error;
		}
		return undefined;
	}
};

const tryLstatSync = (
	fs: Pick<typeof _fs, 'lstatSync'>,
	absolutePath: string,
) => {
	try {
		return fs.lstatSync(absolutePath);
	} catch (error) {
		if (!isMissing(error)) {
			throw error;
		}
		return undefined;
	}
};

const partitionTargets = (
	exports: PackageJson.Exports,
) => {
	const targets = new Set<string>();
	collectExportTargets(exports, targets);

	const wildcardDirectories = new Set<string>();
	const explicitTargets = new Set<string>();
	for (const target of Array.from(targets)) {
		if (target.includes(STAR)) {
			wildcardDirectories.add(wildcardDirectory(target));
		} else {
			explicitTargets.add(target);
		}
	}

	return {
		wildcardDirectories,
		explicitTargets,
	};
};

/**
 * Discover only the files an `exports` map references, instead of scanning the
 * whole package: walk the directory each wildcard target points into, and
 * `lstat` each explicit target. The result is a superset sufficient for
 * `analyzeExportsWithFiles` to produce the same output as a full scan.
 *
 * `lstat` (not `stat`) so symlinked targets are excluded, matching the full
 * scan, which skips symlinks.
 */
export const discoverReferencedFiles = async (
	fs: Pick<typeof _fs.promises, 'readdir' | 'lstat'>,
	packagePath: string,
	exports: PackageJson.Exports,
): Promise<string[]> => {
	const { wildcardDirectories, explicitTargets } = partitionTargets(exports);
	const files = new Set<string>();

	await Promise.all([
		...Array.from(wildcardDirectories, async (relativeDirectory) => {
			const absoluteDirectory = toAbsolute(packagePath, relativeDirectory);
			const stats = await tryLstat(fs, absoluteDirectory);
			// Skip missing dirs and symlinked roots (the latter to match the full walk).
			if (!stats?.isDirectory()) {
				return;
			}
			const collected: string[] = [];
			await walkDirectory(fs, absoluteDirectory, toRelativePrefix(relativeDirectory), collected);
			for (const file of collected) {
				files.add(file);
			}
		}),
		...Array.from(explicitTargets, async (target) => {
			const stats = await tryLstat(fs, path.join(packagePath, target));
			if (stats?.isFile()) {
				files.add(target);
			}
		}),
	]);

	return Array.from(files);
};

export const discoverReferencedFilesSync = (
	fs: Pick<typeof _fs, 'readdirSync' | 'lstatSync'>,
	packagePath: string,
	exports: PackageJson.Exports,
): string[] => {
	const { wildcardDirectories, explicitTargets } = partitionTargets(exports);
	const files = new Set<string>();

	for (const relativeDirectory of Array.from(wildcardDirectories)) {
		const absoluteDirectory = toAbsolute(packagePath, relativeDirectory);
		const stats = tryLstatSync(fs, absoluteDirectory);
		// Skip missing dirs and symlinked roots (the latter to match the full walk).
		if (!stats?.isDirectory()) {
			continue;
		}
		const collected: string[] = [];
		walkDirectorySync(fs, absoluteDirectory, toRelativePrefix(relativeDirectory), collected);
		for (const file of collected) {
			files.add(file);
		}
	}

	for (const target of Array.from(explicitTargets)) {
		const stats = tryLstatSync(fs, path.join(packagePath, target));
		if (stats?.isFile()) {
			files.add(target);
		}
	}

	return Array.from(files);
};
