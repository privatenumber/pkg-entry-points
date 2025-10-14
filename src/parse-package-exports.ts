import type { PackageJson } from 'type-fest';
import type { ParsedExport } from './types.js';

type ParseContext = {
	subpath: string;
	conditionsPath: string[];
};

const traverseExports = (
	exports: PackageJson.Exports,
	context: ParseContext,
	results: ParsedExport[],
): void => {
	if (exports === null) {
		return;
	}

	if (typeof exports === 'string') {
		results.push({
			subpath: context.subpath,
			target: exports,
			conditions: context.conditionsPath.length > 0
				? context.conditionsPath
				: ['default'],
		});
		return;
	}

	if (typeof exports === 'object' && exports) {
		const keys = Object.keys(exports);

		if (keys.length === 0) {
			return;
		}

		const isPathsObject = keys[0][0] === '.';

		if (isPathsObject) {
			// Multiple subpaths
			for (const subpath of keys) {
				if (!Object.hasOwn(exports, subpath)) {
					continue;
				}

				traverseExports(
					(exports as PackageJson.ExportConditions)[subpath]!,
					{ subpath, conditionsPath: [] },
					results,
				);
			}
		} else {
			// Conditions object
			for (const condition of keys) {
				if (!Object.hasOwn(exports, condition)) {
					continue;
				}

				const newConditionsPath = [...context.conditionsPath, condition].sort();

				traverseExports(
					(exports as PackageJson.ExportConditions)[condition]!,
					{ ...context, conditionsPath: newConditionsPath },
					results,
				);
			}
		}
	}
};

export const parsePackageExports = (
	exports: PackageJson.Exports,
): ParsedExport[] => {
	const results: ParsedExport[] = [];

	traverseExports(exports, { subpath: '.', conditionsPath: [] }, results);

	return results;
};
