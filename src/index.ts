import _fs from 'fs';
import path from 'path';
import type { PackageJson } from 'type-fest';
import { getAllFiles } from './utils/get-all-files.js';
import { createPathMatcher, pathMatches, type PathMatcher } from './utils/path-matcher.js';
import { STAR } from './utils/constants.js';

type ConditionToPath = [conditions: string[], internalPath: string];
export type PackageEntryPoints = {
	[subpath: string]: ConditionToPath[];
};

type ConditionsMap = {
	[conditions: string]: (string | [filePath: string, starMatch: string])[] | null;
};

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
						return starValue && [filePath, starValue];
					})
					.filter((starExport): starExport is [string, string] => starExport !== undefined);
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
							[internalPath] = internalPath;
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
			.map(([conditions, internalPath]): ConditionToPath => [JSON.parse(conditions), internalPath])
			.sort(([conditionsA], [conditionsB]) => conditionsA.length - conditionsB.length);

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

	const jsExtension = /\.(?:json|[cm]?js)$/;
	const legacyExports = Object.fromEntries(
		packageFiles
			.filter(filePath => jsExtension.test(filePath))
			.map(filePath => [
				filePath,
				[[['default'], filePath] as ConditionToPath],
			]),
	);

	let packageMain = packageJson.main ?? './index.js';

	if (packageMain[0] !== '.') {
		packageMain = `./${packageMain}`;
	}

	if (packageFiles.includes(packageMain)) {
		legacyExports['.'] = [[['default'], packageMain] as ConditionToPath];
	}

	return legacyExports;
};
