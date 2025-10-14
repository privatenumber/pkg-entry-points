import type { PackageJson } from 'type-fest';
import type { ParsedExport } from './types.js';
import { STAR } from './utils/constants.js';

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
		const subpathHasStar = context.subpath.includes(STAR);

		// Validate subpath wildcard count
		if (subpathHasStar) {
			const subpathParts = context.subpath.split(STAR);
			if (subpathParts.length > 2) {
				throw new Error(`Subpath pattern can contain at most one wildcard: ${context.subpath}`);
			}
		}

		results.push({
			subpath: subpathHasStar ? context.subpath.split(STAR) : context.subpath,
			target: null,
			conditions: context.conditionsPath.length > 0
				? context.conditionsPath
				: ['default'],
		});
		return;
	}

	if (typeof exports === 'string') {
		const subpathHasStar = context.subpath.includes(STAR);
		const targetHasStar = exports.includes(STAR);

		// Validate subpath wildcard count
		if (subpathHasStar) {
			const subpathParts = context.subpath.split(STAR);
			if (subpathParts.length > 2) {
				throw new Error(`Subpath pattern can contain at most one wildcard: ${context.subpath}`);
			}
		}

		results.push({
			subpath: subpathHasStar ? context.subpath.split(STAR) : context.subpath,
			target: targetHasStar ? exports.split(STAR) : exports,
			conditions: context.conditionsPath.length > 0
				? context.conditionsPath
				: ['default'],
		});
		return;
	}

	if (Array.isArray(exports)) {
		for (const entry of exports) {
			traverseExports(entry, context, results);
		}
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
					{
						subpath,
						conditionsPath: [],
					},
					results,
				);
			}
		} else {
			// Conditions object
			for (const condition of keys) {
				if (!Object.hasOwn(exports, condition)) {
					continue;
				}

				const newConditionsPath = [...context.conditionsPath, condition];
				newConditionsPath.sort();

				traverseExports(
					(exports as PackageJson.ExportConditions)[condition]!,
					{
						...context,
						conditionsPath: newConditionsPath,
					},
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

	traverseExports(
		exports,
		{
			subpath: '.',
			conditionsPath: [],
		},
		results,
	);

	return results;
};
