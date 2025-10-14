import _fs from 'fs';
import path from 'path';
import type { PackageJson } from 'type-fest';
import { getAllFiles, getAllFilesSync } from './utils/get-all-files.js';
import { createPathMatcher, pathMatches, type PathMatcher } from './utils/path-matcher.js';
import { STAR } from './utils/constants.js';
import { analyzeLegacyExports } from './legacy-resolver.js';
import type {
	ConditionsMap, PackageEntryPoints, StarMatch, ConditionToPath,
} from './types.js';
import { analyzePackageExportsLazy, analyzePackageExportsLazyAsync } from './lazy-analyzer.js';

// Export new lazy API
export { analyzePackageExportsLazy };
export type { FileSystemAccess, AsyncFileSystemAccess } from './filesystem-access.js';

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

	if (packageJson.exports !== undefined) {
		// Use lazy API with async filesystem adapter
		const fsAccess = {
			async fileExists(filePath: string): Promise<boolean> {
				try {
					const fullPath = path.join(packagePath, filePath);
					const stats = await fs.stat(fullPath);
					return stats.isFile();
				} catch {
					return false;
				}
			},

			async listDirectory(directoryPath: string): Promise<string[]> {
				try {
					const fullPath = path.join(packagePath, directoryPath);
					const entries = await fs.readdir(fullPath);

					const results = await Promise.all(
						entries.map(async (entry) => {
							let entryPath = path.join(directoryPath, entry);
							// Ensure path starts with ./ for consistency with getAllFiles
							if (!entryPath.startsWith('./')) {
								entryPath = `./${entryPath}`;
							}
							const fullEntryPath = path.join(packagePath, entryPath);
							try {
								const stats = await fs.stat(fullEntryPath);
								if (stats.isDirectory()) {
									// Recursively collect files from subdirectories
									return await fsAccess.listDirectory(entryPath);
								}
								return stats.isFile() ? [entryPath] : [];
							} catch {
								return [];
							}
						}),
					);

					return results.flat().filter((entry): entry is string => entry !== null);
				} catch {
					return [];
				}
			},
		};

		// Wrap analyzePackageExportsLazy to handle Promise returns
		return analyzePackageExportsLazyAsync(packageJson.exports, fsAccess);
	}

	// Fallback to legacy for packages without exports
	const packageFiles = await getAllFiles(fs, packagePath);
	return analyzeLegacyExports(packageJson, packageFiles);
};

export const getPackageEntryPointsSync = (
	packagePath: string,
	fs = _fs,
): PackageEntryPoints => {
	const packageJsonString = fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8');
	const packageJson = JSON.parse(packageJsonString) as PackageJson;

	if (packageJson.exports !== undefined) {
		// Use lazy API with sync filesystem adapter
		const fsAccess = {
			fileExists(filePath: string): boolean {
				try {
					const fullPath = path.join(packagePath, filePath);
					const stats = fs.statSync(fullPath);
					return stats.isFile();
				} catch {
					return false;
				}
			},

			listDirectory(directoryPath: string): string[] {
				try {
					const fullPath = path.join(packagePath, directoryPath);
					const entries = fs.readdirSync(fullPath);

					return entries
						.map((entry) => {
							let entryPath = path.join(directoryPath, entry);
							// Ensure path starts with ./ for consistency with getAllFilesSync
							if (!entryPath.startsWith('./')) {
								entryPath = `./${entryPath}`;
							}
							const fullEntryPath = path.join(packagePath, entryPath);
							try {
								const stats = fs.statSync(fullEntryPath);
								if (stats.isDirectory()) {
									// Recursively collect files from subdirectories
									return fsAccess.listDirectory(entryPath);
								}
								return stats.isFile() ? [entryPath] : [];
							} catch {
								return [];
							}
						})
						.flat()
						.filter((entry): entry is string => entry !== null);
				} catch {
					return [];
				}
			},
		};

		return analyzePackageExportsLazy(packageJson.exports, fsAccess);
	}

	// Fallback to legacy for packages without exports
	const packageFiles = getAllFilesSync(fs, packagePath);
	return analyzeLegacyExports(packageJson, packageFiles);
};
