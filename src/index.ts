import _fs from 'fs';
import path from 'path';
import type { PackageJson } from 'type-fest';
import { getAllFiles, getAllFilesSync } from './utils/get-all-files.js';
import { createPathMatcher, pathMatches, type PathMatcher } from './utils/path-matcher.js';
import { STAR } from './utils/constants.js';
import { resolveLegacyEntries } from './resolve-legacy-entries.js';
import type {
	ConditionsMap, PackageEntryPoints, StarMatch, ConditionToPath,
} from './types.js';

type GetConditions = {
	(
		packageFiles: string[],
		exports: PackageJson.Exports,
	): ConditionsMap;
	(
		packageFiles: string[],
		exports: PackageJson.Exports,
		conditionsPath: string[],
		conditions: ConditionsMap,
	): ConditionsMap | string;
};

const getConditions: GetConditions = (
	packageFiles: string[],
	exports: PackageJson.Exports,
	conditionsPath: string[] = [],
	conditions: ConditionsMap = {},
) => {
	if (
		exports === null
		|| typeof exports === 'string'
	) {
		if (conditionsPath.length === 0) {
			conditionsPath.push('default');
		}

		const conditionsKey = JSON.stringify(conditionsPath);
		if (!Object.hasOwn(conditions, conditionsKey)) {
			if (exports === null) {
				conditions[conditionsKey] = exports;
			} else if (exports.includes(STAR)) {
				const pathMatcher = createPathMatcher(exports);
				conditions[conditionsKey] = packageFiles
					.map((filePath) => {
						const starValue = pathMatches(pathMatcher, filePath);
						return starValue !== undefined && [filePath, starValue];
					})
					.filter((starExport): starExport is StarMatch => starExport !== false);
			} else if (packageFiles.includes(exports)) {
				conditions[conditionsKey] = [exports];
			}
		}
	} else if (Array.isArray(exports)) {
		for (const ex of exports) {
			getConditions(
				packageFiles,
				ex,
				conditionsPath,
				conditions,
			);
		}
	} else if (typeof exports === 'object' && exports) {
		for (const condition in exports) {
			if (!Object.hasOwn(exports, condition)) {
				continue;
			}

			const newConditions = conditionsPath.slice();
			if (!newConditions.includes(condition)) {
				newConditions.push(condition);
			}

			getConditions(
				packageFiles,
				exports[condition]!,
				newConditions.sort(),
				conditions,
			);
		}
	}

	return conditions;
};

const analyzeExportsWithFiles = (
	exports: PackageJson.Exports,
	packageFiles: string[],
): PackageEntryPoints => {
	if (exports === null) {
		return {};
	}

	let keys = Object.keys(exports);
	if (keys.length === 0) {
		return {};
	}

	const isPathsObject = keys[0][0] === '.';
	if (!isPathsObject) {
		exports = { '.': exports };
		keys = ['.'];
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

	for (const rawSubpath of keys) {
		const conditions = getConditions(
			packageFiles,
			(exports as PackageJson.ExportConditions)[rawSubpath]!,
		);

		const subpathStar = rawSubpath.includes(STAR);
		for (const condition in conditions) {
			if (!Object.hasOwn(conditions, condition)) {
				continue;
			}

			const internalPaths = conditions[condition];
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

					subpathConditions[subpath][condition] = (
						Array.isArray(internalPath)
							? internalPath[0]
							: internalPath
					);
				}
			} else {
				blocks.push([
					subpathStar ? createPathMatcher(rawSubpath) : rawSubpath,
					condition,
				]);
			}
		}
	}

	/**
	 * Index blocks so each subpath is matched once: exact-subpath blocks become
	 * O(1) Map lookups, and only wildcard blocks are matched per subpath. This
	 * replaces rescanning every block for every (subpath × condition) pair.
	 */
	const exactBlocks = new Map<string, Set<string>>();
	const starBlocks: [PathMatcher, string][] = [];
	for (const [blockPath, blockCondition] of blocks) {
		if (typeof blockPath === 'string') {
			let blockedConditions = exactBlocks.get(blockPath);
			if (!blockedConditions) {
				blockedConditions = new Set();
				exactBlocks.set(blockPath, blockedConditions);
			}
			blockedConditions.add(blockCondition);
		} else {
			starBlocks.push([blockPath, blockCondition]);
		}
	}
	const hasStarBlocks = starBlocks.length > 0;

	const unblockedExports: PackageEntryPoints = {};
	for (const subpath in subpathConditions) {
		if (!Object.hasOwn(subpathConditions, subpath)) {
			continue;
		}

		// Conditions blocked for this subpath (exact blocks, plus any wildcard hits).
		let blockedConditions = exactBlocks.get(subpath);
		if (hasStarBlocks) {
			let matchedConditions: Set<string> | undefined;
			for (let i = 0; i < starBlocks.length; i += 1) {
				if (pathMatches(starBlocks[i][0], subpath)) {
					if (!matchedConditions) {
						matchedConditions = new Set(blockedConditions);
					}
					matchedConditions.add(starBlocks[i][1]);
				}
			}
			if (matchedConditions) {
				blockedConditions = matchedConditions;
			}
		}

		const subpathMap = subpathConditions[subpath];
		const conditionsEntries: ConditionToPath[] = [];
		for (const conditions in subpathMap) {
			if (!Object.hasOwn(subpathMap, conditions)) {
				continue;
			}

			if (blockedConditions?.has(conditions)) {
				continue;
			}

			conditionsEntries.push([JSON.parse(conditions), subpathMap[conditions]]);
		}
		conditionsEntries.sort(([conditionsA], [conditionsB]) => conditionsA.length - conditionsB.length);

		if (conditionsEntries.length > 0) {
			unblockedExports[subpath] = conditionsEntries;
		}
	}

	return unblockedExports;
};

export const getPackageEntryPoints = async (
	packagePath: string,
	fs = _fs.promises,
): Promise<PackageEntryPoints> => {
	const packageJsonString = await fs.readFile(path.join(packagePath, 'package.json'), 'utf8');
	const packageJson = JSON.parse(packageJsonString) as PackageJson;
	const packageFiles = await getAllFiles(fs, packagePath);

	if (packageJson.exports !== undefined) {
		return analyzeExportsWithFiles(packageJson.exports, packageFiles);
	}

	return resolveLegacyEntries(packageJson, packageFiles);
};

export const getPackageEntryPointsSync = (
	packagePath: string,
	fs = _fs,
): PackageEntryPoints => {
	const packageJsonString = fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8');
	const packageJson = JSON.parse(packageJsonString) as PackageJson;
	const packageFiles = getAllFilesSync(fs, packagePath);

	if (packageJson.exports !== undefined) {
		return analyzeExportsWithFiles(packageJson.exports, packageFiles);
	}

	return resolveLegacyEntries(packageJson, packageFiles);
};
