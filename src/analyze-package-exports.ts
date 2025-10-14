import type { PackageJson } from 'type-fest';
import type { PackageEntryPoints, ConditionsMap, StarMatch } from './types.js';
import { createPathMatcher, pathMatches, type PathMatcher } from './utils/path-matcher.js';
import { STAR } from './utils/constants.js';
import type { AsyncFileSystemAccess, FileSystemAccess } from './create-fs-access.js';

/**
 * Extract directory path from a wildcard pattern
 * Example: "./src/*.js" → "./src"
 */
const extractDirectoryFromPattern = (pattern: string): string => {
	const starIndex = pattern.indexOf(STAR);
	if (starIndex === -1) {
		return '.';
	}

	// Find the last slash before the star
	const beforeStar = pattern.slice(0, starIndex);
	const lastSlash = beforeStar.lastIndexOf('/');

	return lastSlash === -1 ? '.' : beforeStar.slice(0, lastSlash);
};

type ExportAttempt = {
	key: string;
	path: string | null;
};

/**
 * Phase 1: Collect all condition→path attempts by walking exports tree
 * Pure function - no filesystem access
 */
const collectExportAttempts = (
	exports: PackageJson.Exports,
	conditionsPath: string[] = [],
): ExportAttempt[] => {
	const attempts: ExportAttempt[] = [];

	const recurse = (
		value: PackageJson.Exports,
		currentConditions: string[],
	): void => {
		if (value === null) {
			attempts.push({
				key: JSON.stringify(currentConditions.length === 0 ? ['default'] : currentConditions),
				path: null,
			});
		} else if (typeof value === 'string') {
			attempts.push({
				key: JSON.stringify(currentConditions.length === 0 ? ['default'] : currentConditions),
				path: value,
			});
		} else if (Array.isArray(value)) {
			for (const item of value) {
				recurse(item, currentConditions);
			}
		} else if (value && typeof value === 'object') {
			for (const condition in value) {
				if (!Object.hasOwn(value, condition)) {
					continue;
				}

				const newConditions = currentConditions.slice();
				if (!newConditions.includes(condition)) {
					newConditions.push(condition);
				}

				recurse(value[condition]!, newConditions.sort());
			}
		}
	};

	recurse(exports, conditionsPath);
	return attempts;
};

/**
 * Phase 2: Resolve attempts with async filesystem access
 */
const resolveAttemptsAsync = async (
	attempts: ExportAttempt[],
	fs: AsyncFileSystemAccess,
): Promise<ConditionsMap> => {
	const conditions: ConditionsMap = {};

	for (const { key, path } of attempts) {
		if (Object.hasOwn(conditions, key)) {
			continue; // First-wins semantics
		}

		if (path === null) {
			conditions[key] = null;
		} else if (path.includes(STAR)) {
			const pathMatcher = createPathMatcher(path);
			const directoryPath = extractDirectoryFromPattern(path);
			const files = await fs.readdirAll(directoryPath);

			const matches: StarMatch[] = files
				.map((filePath) => {
					const starValue = pathMatches(pathMatcher, filePath);
					return starValue === undefined ? null : [filePath, starValue] as StarMatch;
				})
				.filter((match): match is StarMatch => match !== null);

			if (matches.length > 0) {
				conditions[key] = matches;
			}
		} else if (await fs.fileExists(path)) {
			conditions[key] = [path];
		}
	}

	return conditions;
};

/**
 * Phase 2: Resolve attempts with sync filesystem access
 */
const resolveAttempts = (
	attempts: ExportAttempt[],
	fs: FileSystemAccess,
): ConditionsMap => {
	const conditions: ConditionsMap = {};

	for (const { key, path } of attempts) {
		if (Object.hasOwn(conditions, key)) {
			continue; // First-wins semantics
		}

		if (path === null) {
			conditions[key] = null;
		} else if (path.includes(STAR)) {
			const pathMatcher = createPathMatcher(path);
			const directoryPath = extractDirectoryFromPattern(path);
			const files = fs.readdirAll(directoryPath);

			const matches: StarMatch[] = files
				.map((filePath) => {
					const starValue = pathMatches(pathMatcher, filePath);
					return starValue === undefined ? null : [filePath, starValue] as StarMatch;
				})
				.filter((match): match is StarMatch => match !== null);

			if (matches.length > 0) {
				conditions[key] = matches;
			}
		} else if (fs.fileExists(path)) {
			conditions[key] = [path];
		}
	}

	return conditions;
};

/**
 * Normalize exports to always be an object with subpaths
 */
const normalizeExports = (
	exports: PackageJson.Exports | undefined,
): Record<string, PackageJson.Exports> | null => {
	if (!exports || exports === null) {
		return null;
	}

	if (typeof exports === 'string' || Array.isArray(exports)) {
		return { '.': exports };
	}

	const keys = Object.keys(exports);
	if (keys.length === 0) {
		return null;
	}

	// Check if it's already a subpath object (keys start with '.')
	if (keys[0][0] === '.') {
		return exports as Record<string, PackageJson.Exports>;
	}

	// It's a conditions object at root
	return { '.': exports };
};

/**
 * Filter out blocked exports
 */
const filterBlockedExports = (
	subpathConditions: Record<string, Record<string, string>>,
	blocks: Array<[string | PathMatcher, string]>,
): PackageEntryPoints => {
	const unblockedExports: PackageEntryPoints = {};

	for (const subpath in subpathConditions) {
		if (!Object.hasOwn(subpathConditions, subpath)) {
			continue;
		}

		const conditionsEntries = Object.entries(subpathConditions[subpath])
			.filter(
				([conditions]) => !blocks.some(
					([blockPath, blockCondition]) => (
						(
							typeof blockPath === 'string'
								? blockPath === subpath
								: pathMatches(blockPath, subpath)
						)
						&& conditions === blockCondition
					),
				),
			)
			.map(
				([conditions, internalPath]): [string[], string] => [JSON.parse(conditions), internalPath],
			)
			.sort(([conditionsA], [conditionsB]) => conditionsA.length - conditionsB.length);

		if (conditionsEntries.length > 0) {
			unblockedExports[subpath] = conditionsEntries;
		}
	}

	return unblockedExports;
};

/**
 * Analyze exports with filesystem access.
 *
 * Instead of scanning all files upfront, this function:
 * 1. Walks the exports tree to find file references
 * 2. Checks only those specific files
 * 3. For wildcards, lists only the relevant directories
 */
export const analyzePackageExports = (
	exports: PackageJson.Exports | undefined,
	fs: FileSystemAccess,
): PackageEntryPoints => {
	const exportsObject = normalizeExports(exports);
	if (!exportsObject) {
		return {};
	}

	const subpathConditions: {
		[subpath: string]: {
			[conditions: string]: string;
		};
	} = {};

	const blocks: [
		subpath: string | PathMatcher,
		condition: string,
	][] = [];

	// Walk each subpath
	for (const rawSubpath of Object.keys(exportsObject)) {
		const subpathExports = exportsObject[rawSubpath]!;
		const attempts = collectExportAttempts(subpathExports);
		const conditions = resolveAttempts(attempts, fs);

		const subpathStar = rawSubpath.includes(STAR);

		for (const conditionKey in conditions) {
			if (!Object.hasOwn(conditions, conditionKey)) {
				continue;
			}

			const internalPaths = conditions[conditionKey];

			if (internalPaths) {
				for (let internalPath of internalPaths) {
					let subpath = rawSubpath;
					if (subpathStar) {
						const hasStar = Array.isArray(internalPath);
						subpath = rawSubpath.split(STAR).join(
							hasStar
								? internalPath[1]
								: '_',
						);

						if (hasStar) {
							internalPath = (internalPath as StarMatch)[0];
						}
					}

					if (!subpathConditions[subpath]) {
						subpathConditions[subpath] = {};
					}

					subpathConditions[subpath][conditionKey] = (
						Array.isArray(internalPath)
							? internalPath[0]
							: internalPath
					);
				}
			} else {
				// null export - blocking
				blocks.push([
					subpathStar ? createPathMatcher(rawSubpath) : rawSubpath,
					conditionKey,
				]);
			}
		}
	}

	return filterBlockedExports(subpathConditions, blocks);
};

/**
 * Async version of analyzePackageExports
 */
export const analyzePackageExportsAsync = async (
	exports: PackageJson.Exports | undefined,
	fs: AsyncFileSystemAccess,
): Promise<PackageEntryPoints> => {
	const exportsObject = normalizeExports(exports);
	if (!exportsObject) {
		return {};
	}

	const subpathConditions: {
		[subpath: string]: {
			[conditions: string]: string;
		};
	} = {};

	const blocks: [
		subpath: string | PathMatcher,
		condition: string,
	][] = [];

	// Walk each subpath
	for (const rawSubpath of Object.keys(exportsObject)) {
		const subpathExports = exportsObject[rawSubpath]!;
		const attempts = collectExportAttempts(subpathExports);
		const conditions = await resolveAttemptsAsync(attempts, fs);

		const subpathStar = rawSubpath.includes(STAR);

		for (const conditionKey in conditions) {
			if (!Object.hasOwn(conditions, conditionKey)) {
				continue;
			}

			const internalPaths = conditions[conditionKey];

			if (internalPaths) {
				for (let internalPath of internalPaths) {
					let subpath = rawSubpath;
					if (subpathStar) {
						const hasStar = Array.isArray(internalPath);
						subpath = rawSubpath.split(STAR).join(
							hasStar
								? internalPath[1]
								: '_',
						);

						if (hasStar) {
							internalPath = (internalPath as StarMatch)[0];
						}
					}

					if (!subpathConditions[subpath]) {
						subpathConditions[subpath] = {};
					}

					subpathConditions[subpath][conditionKey] = (
						Array.isArray(internalPath)
							? internalPath[0]
							: internalPath
					);
				}
			} else {
				blocks.push([
					subpathStar ? createPathMatcher(rawSubpath) : rawSubpath,
					conditionKey,
				]);
			}
		}
	}

	return filterBlockedExports(subpathConditions, blocks);
};
