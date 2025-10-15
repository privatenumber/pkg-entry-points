import _fs from 'fs';
import path from 'path';
import type { PackageJson } from 'type-fest';
import { getAllFiles, getAllFilesSync } from './utils/get-all-files.js';
import { resolveLegacyEntries } from './resolve-legacy-entries.js';
import { parsePackageExports } from './parse-package-exports.js';
import { analyzeExportsWithFiles } from './analyze-exports-with-files.js';
import type { PackageEntryPoints } from './types.js';


export const getPackageEntryPoints = async (
	packagePath: string,
	fs = _fs.promises,
): Promise<PackageEntryPoints> => {
	const packageJsonString = await fs.readFile(path.join(packagePath, 'package.json'), 'utf8');
	const packageJson = JSON.parse(packageJsonString) as PackageJson;
	const packageFiles = await getAllFiles(fs, packagePath);

	if (packageJson.exports !== undefined) {
		const parsed = parsePackageExports(packageJson.exports);
		return analyzeExportsWithFiles(parsed, packageFiles);
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
		const parsed = parsePackageExports(packageJson.exports);
		return analyzeExportsWithFiles(parsed, packageFiles);
	}

	return resolveLegacyEntries(packageJson, packageFiles);
};

export { parsePackageExports } from './parse-package-exports.js';
export type { ParsedExport } from './types.js';
