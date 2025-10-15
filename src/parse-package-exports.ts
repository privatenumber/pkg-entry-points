import type { PackageJson } from 'type-fest';
import type { ParsedExport, ParseResult } from './types.js';
import { STAR } from './utils/constants.js';

type ParseContext = {
	subpath: string;
	conditionsPath: string[];
};

const traverseExports = (
	exports: PackageJson.Exports,
	context: ParseContext,
	results: ParsedExport[],
	errors: Error[],
): void => {
	if (exports === null || typeof exports === 'string') {
		const subpathHasStar = context.subpath.includes(STAR);
		let subpathParts: string[] | undefined;

		// Validate subpath wildcard count
		if (subpathHasStar) {
			subpathParts = context.subpath.split(STAR);
			if (subpathParts.length > 2) {
				errors.push(new Error(`Subpath pattern can contain at most one wildcard: ${context.subpath}`));
				return;
			}
		}

		results.push({
			subpath: subpathParts ?? context.subpath,
			target: exports === null
				? null
				: (
					exports.includes(STAR)
						? exports.split(STAR)
						: exports
				),
			conditions: (
				context.conditionsPath.length > 0
					? context.conditionsPath
					: ['default']
			),
		});
		return;
	}

	if (Array.isArray(exports)) {
		for (const entry of exports) {
			traverseExports(entry, context, results, errors);
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
				if (Object.hasOwn(exports, subpath)) {
					// Validate subpath starts with '.'
					if (!subpath.startsWith('.')) {
						errors.push(new Error(`Invalid subpath "${subpath}": must start with "."`));
						continue;
					}

					traverseExports(
						(exports as PackageJson.ExportConditions)[subpath]!,
						{
							subpath,
							conditionsPath: [],
						},
						results,
						errors,
					);
				}
			}
		} else {
			// Conditions object
			for (const condition of keys) {
				if (Object.hasOwn(exports, condition)) {
					const newConditionsPath = [...context.conditionsPath, condition];
					newConditionsPath.sort();

					traverseExports(
						(exports as PackageJson.ExportConditions)[condition]!,
						{
							...context,
							conditionsPath: newConditionsPath,
						},
						results,
						errors,
					);
				}
			}
		}
	}
};

export const parsePackageExports = (
	exports: PackageJson.Exports,
): ParseResult => {
	const results: ParsedExport[] = [];
	const errors: Error[] = [];

	traverseExports(
		exports,
		{
			subpath: '.',
			conditionsPath: [],
		},
		results,
		errors,
	);

	return {
		parsed: results,
		errors,
	};
};
