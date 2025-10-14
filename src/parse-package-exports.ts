import type { PackageJson } from 'type-fest';
import type { ParsedExport } from './types.js';

export const parsePackageExports = (
	exports: PackageJson.Exports,
): ParsedExport[] => {
	if (typeof exports === 'string') {
		return [
			{
				subpath: '.',
				target: exports,
				conditions: ['default'],
			},
		];
	}

	return [];
};
