import _fs from 'fs';
import type { PackageJson } from 'type-fest';
import type { ConditionToPath, PackageEntryPoints } from './types.js';

const legacyCondition = (
	filePath: string,
) => [[['default'], filePath] as ConditionToPath];

/**
 * Resolve entry points for legacy packages (without exports field).
 *
 * For packages without exports, every JS file is a potential entry point.
 * This requires eagerly scanning all files in the package directory.
 */
export const resolveLegacyEntries = (
	packageJson: PackageJson,
	packageFiles: string[],
): PackageEntryPoints => {
	const jsExtension = /\.(?:json|[cm]?js|d\.ts)$/;
	const legacyExports = Object.fromEntries(
		packageFiles
			.filter(filePath => jsExtension.test(filePath))
			.map(filePath => [
				filePath,
				legacyCondition(filePath),
			]),
	);

	let packageMain = packageJson.main ?? './index.js';
	if (packageMain[0] !== '.') {
		packageMain = `./${packageMain}`;
	}

	for (const extension of ['', '.js', '.json']) {
		const target = packageMain + extension;
		if (packageFiles.includes(target)) {
			legacyExports['.'] = legacyCondition(target);
			legacyExports[target] = legacyCondition(target);
			break;
		}
	}

	return legacyExports;
};
