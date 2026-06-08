import _fs from 'fs';
import path from 'path';
import type { PackageJson } from 'type-fest';
import {
	getAllFiles, getAllFilesSync, discoverReferencedFiles, discoverReferencedFilesSync,
} from './utils/get-all-files.js';
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

		const conditionsKey = conditionsPath.join('\0');
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

type Block = [subpath: string | PathMatcher, condition: string];

type SubpathConditions = {
	[conditions: string]: string;
};

/**
 * Split blocks into exact-subpath blocks (matched via O(1) Map lookup) and
 * wildcard blocks (matched per subpath). This avoids rescanning every block
 * for every (subpath × condition) pair.
 */
const indexBlocks = (
	blocks: Block[],
) => {
	const exactBlocks = new Map<string, Set<string>>();
	const starBlocks: [PathMatcher, string][] = [];
	for (const [blockPath, blockCondition] of blocks) {
		if (typeof blockPath === 'string') {
			let conditions = exactBlocks.get(blockPath);
			if (!conditions) {
				conditions = new Set();
				exactBlocks.set(blockPath, conditions);
			}
			conditions.add(blockCondition);
		} else {
			starBlocks.push([blockPath, blockCondition]);
		}
	}

	return {
		exactBlocks,
		starBlocks,
	};
};

/**
 * Conditions blocked for a subpath: its exact-block conditions, plus any
 * matching wildcard-block conditions.
 */
const getBlockedConditions = (
	subpath: string,
	exactBlocks: Map<string, Set<string>>,
	starBlocks: [PathMatcher, string][],
): Set<string> | undefined => {
	const exactBlocked = exactBlocks.get(subpath);
	if (starBlocks.length === 0) {
		return exactBlocked;
	}

	let blocked: Set<string> | undefined;
	for (let i = 0; i < starBlocks.length; i += 1) {
		const starBlock = starBlocks[i];
		if (pathMatches(starBlock[0], subpath)) {
			if (!blocked) {
				blocked = new Set(exactBlocked);
			}
			blocked.add(starBlock[1]);
		}
	}

	return blocked ?? exactBlocked;
};

/**
 * Build the unblocked, sorted condition/path entries for a single subpath.
 */
const collectSubpathEntries = (
	subpathMap: SubpathConditions,
	blockedConditions: Set<string> | undefined,
): ConditionToPath[] => {
	const entries: ConditionToPath[] = [];
	for (const conditions in subpathMap) {
		if (!Object.hasOwn(subpathMap, conditions)) {
			continue;
		}

		if (blockedConditions?.has(conditions)) {
			continue;
		}

		entries.push([conditions.split('\0'), subpathMap[conditions]]);
	}

	entries.sort(
		([conditionsA], [conditionsB]) => conditionsA.length - conditionsB.length,
	);

	return entries;
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
		[subpath: string]: SubpathConditions;
	} = {};

	const blocks: Block[] = [];

	for (const rawSubpath of keys) {
		const conditions = getConditions(
			packageFiles,
			(exports as PackageJson.ExportConditions)[rawSubpath]!,
		);

		const subpathStar = rawSubpath.includes(STAR);
		const subpathParts = subpathStar ? rawSubpath.split(STAR) : undefined;
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
						subpath = subpathParts!.join(
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

	const { exactBlocks, starBlocks } = indexBlocks(blocks);

	const unblockedExports: PackageEntryPoints = {};
	for (const subpath in subpathConditions) {
		if (!Object.hasOwn(subpathConditions, subpath)) {
			continue;
		}

		const blockedConditions = getBlockedConditions(subpath, exactBlocks, starBlocks);
		const conditionsEntries = collectSubpathEntries(
			subpathConditions[subpath],
			blockedConditions,
		);
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

	if (packageJson.exports !== undefined) {
		const packageFiles = await discoverReferencedFiles(fs, packagePath, packageJson.exports);
		return analyzeExportsWithFiles(packageJson.exports, packageFiles);
	}

	const packageFiles = await getAllFiles(fs, packagePath);
	return resolveLegacyEntries(packageJson, packageFiles);
};

export const getPackageEntryPointsSync = (
	packagePath: string,
	fs = _fs,
): PackageEntryPoints => {
	const packageJsonString = fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8');
	const packageJson = JSON.parse(packageJsonString) as PackageJson;

	if (packageJson.exports !== undefined) {
		const packageFiles = discoverReferencedFilesSync(fs, packagePath, packageJson.exports);
		return analyzeExportsWithFiles(packageJson.exports, packageFiles);
	}

	const packageFiles = getAllFilesSync(fs, packagePath);
	return resolveLegacyEntries(packageJson, packageFiles);
};
