import type { PackageJson } from 'type-fest';
import type { FileSystemAccess, AsyncFileSystemAccess } from './filesystem-access';
import type { PackageEntryPoints, ConditionsMap, StarMatch } from './types.js';
import { createPathMatcher, pathMatches, type PathMatcher } from './utils/path-matcher.js';
import { STAR } from './utils/constants.js';

/**
 * Analyze exports with lazy filesystem access.
 *
 * Instead of scanning all files upfront, this function:
 * 1. Walks the exports tree to find file references
 * 2. Checks only those specific files
 * 3. For wildcards, lists only the relevant directories
 */
export function analyzePackageExportsLazy(
	exports: PackageJson.Exports | undefined,
	fs: FileSystemAccess,
): PackageEntryPoints {
	if (!exports || exports === null) {
		return {};
	}

	// Normalize exports to always be an object with subpaths
	let exportsObject: Record<string, PackageJson.Exports>;
	if (typeof exports === 'string' || Array.isArray(exports)) {
		exportsObject = { '.': exports };
	} else {
		const keys = Object.keys(exports);
		if (keys.length === 0) {
			return {};
		}
		// Check if it's already a subpath object (keys start with '.')
		if (keys[0][0] === '.') {
			exportsObject = exports as Record<string, Exports>;
		} else {
			// It's a conditions object at root
			exportsObject = { '.': exports };
		}
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
		const conditions = getConditionsLazy(fs, subpathExports, rawSubpath);

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

	// Filter out blocked exports
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
			.map(([conditions, internalPath]): [string[], string] => [JSON.parse(conditions), internalPath])
			.sort(([conditionsA], [conditionsB]) => conditionsA.length - conditionsB.length);

		if (conditionsEntries.length > 0) {
			unblockedExports[subpath] = conditionsEntries;
		}
	}

	return unblockedExports;
}

/**
 * Recursively walk exports tree, checking files lazily
 */
function getConditionsLazy(
	fs: FileSystemAccess,
	exports: PackageJson.Exports,
	subpathPattern?: string,
	conditionsPath: string[] = [],
): ConditionsMap {
	const conditions: ConditionsMap = {};

	function recurse(
		value: PackageJson.Exports,
		currentConditions: string[],
	): void {
		if (value === null) {
			// Blocking export
			const key = JSON.stringify(currentConditions.length === 0 ? ['default'] : currentConditions);
			conditions[key] = null;
		} else if (typeof value === 'string') {
			// Leaf node - actual file path
			const key = JSON.stringify(currentConditions.length === 0 ? ['default'] : currentConditions);

			if (!Object.hasOwn(conditions, key)) {
				// Check if file exists (lazy)
				if (value.includes(STAR)) {
					// Wildcard - need to list directory
					const pathMatcher = createPathMatcher(value);
					const directoryPath = extractDirectoryFromPattern(value);
					const files = fs.listDirectory(directoryPath);

					const matches: StarMatch[] = files
						.map((filePath) => {
							const starValue = pathMatches(pathMatcher, filePath);
							return starValue !== undefined ? [filePath, starValue] as StarMatch : null;
						})
						.filter((match): match is StarMatch => match !== null);

					if (matches.length > 0) {
						conditions[key] = matches;
					}
				} else {
					// Direct file check
					if (fs.fileExists(value)) {
						conditions[key] = [value];
					}
				}
			}
		} else if (Array.isArray(value)) {
			// Fallback array
			for (const item of value) {
				recurse(item, currentConditions);
			}
		} else if (value && typeof value === 'object') {
			// Conditions object
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
	}

	recurse(exports, conditionsPath);
	return conditions;
}

/**
 * Extract directory path from a wildcard pattern
 * Example: "./src/*.js" → "./src"
 */
function extractDirectoryFromPattern(pattern: string): string {
	const starIndex = pattern.indexOf(STAR);
	if (starIndex === -1) {
		return '.';
	}

	// Find the last slash before the star
	const beforeStar = pattern.slice(0, starIndex);
	const lastSlash = beforeStar.lastIndexOf('/');

	return lastSlash === -1 ? '.' : beforeStar.slice(0, lastSlash);
}

/**
 * Async version of analyzePackageExportsLazy
 */
export async function analyzePackageExportsLazyAsync(
	exports: PackageJson.Exports | undefined,
	fs: AsyncFileSystemAccess,
): Promise<PackageEntryPoints> {
	if (!exports || exports === null) {
		return {};
	}

	// Normalize exports to always be an object with subpaths
	let exportsObject: Record<string, PackageJson.Exports>;
	if (typeof exports === 'string' || Array.isArray(exports)) {
		exportsObject = { '.': exports };
	} else {
		const keys = Object.keys(exports);
		if (keys.length === 0) {
			return {};
		}
		if (keys[0][0] === '.') {
			exportsObject = exports as Record<string, PackageJson.Exports>;
		} else {
			exportsObject = { '.': exports };
		}
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
		const conditions = await getConditionsLazyAsync(fs, subpathExports, rawSubpath);

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

	// Filter out blocked exports
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
			.map(([conditions, internalPath]): [string[], string] => [JSON.parse(conditions), internalPath])
			.sort(([conditionsA], [conditionsB]) => conditionsA.length - conditionsB.length);

		if (conditionsEntries.length > 0) {
			unblockedExports[subpath] = conditionsEntries;
		}
	}

	return unblockedExports;
}

async function getConditionsLazyAsync(
	fs: AsyncFileSystemAccess,
	exports: PackageJson.Exports,
	subpathPattern?: string,
	conditionsPath: string[] = [],
): Promise<ConditionsMap> {
	const conditions: ConditionsMap = {};

	async function recurse(
		value: PackageJson.Exports,
		currentConditions: string[],
	): Promise<void> {
		if (value === null) {
			const key = JSON.stringify(currentConditions.length === 0 ? ['default'] : currentConditions);
			conditions[key] = null;
		} else if (typeof value === 'string') {
			const key = JSON.stringify(currentConditions.length === 0 ? ['default'] : currentConditions);

			if (!Object.hasOwn(conditions, key)) {
				if (value.includes(STAR)) {
					const pathMatcher = createPathMatcher(value);
					const directoryPath = extractDirectoryFromPattern(value);
					const files = await fs.listDirectory(directoryPath);

					const matches: StarMatch[] = files
						.map((filePath) => {
							const starValue = pathMatches(pathMatcher, filePath);
							return starValue !== undefined ? [filePath, starValue] as StarMatch : null;
						})
						.filter((match): match is StarMatch => match !== null);

					if (matches.length > 0) {
						conditions[key] = matches;
					}
				} else {
					if (await fs.fileExists(value)) {
						conditions[key] = [value];
					}
				}
			}
		} else if (Array.isArray(value)) {
			for (const item of value) {
				await recurse(item, currentConditions);
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

				await recurse(value[condition]!, newConditions.sort());
			}
		}
	}

	await recurse(exports, conditionsPath);
	return conditions;
}
