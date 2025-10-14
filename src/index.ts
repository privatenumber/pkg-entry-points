import _fs from 'fs';
import path from 'path';
import type { PackageJson } from 'type-fest';
import { resolveLegacyMain, resolveLegacyMainAsync } from './resolve-legacy-main.js';
import type { PackageEntryPoints } from './types.js';
import { analyzePackageExports, analyzePackageExportsAsync } from './analyze-package-exports.js';
import { createAsyncFsAccess, createFsAccess } from './create-fs-access.js';

// Export new API
export { analyzePackageExports };
export type { FileSystemAccess, AsyncFileSystemAccess } from './analyze-package-exports.js';

export const getPackageEntryPoints = async (
	packagePath: string,
	fs = _fs.promises,
): Promise<PackageEntryPoints> => {
	const packageJsonString = await fs.readFile(path.join(packagePath, 'package.json'), 'utf8');
	const packageJson = JSON.parse(packageJsonString) as PackageJson;

	const fsAccess = createAsyncFsAccess(packagePath, fs);

	if (packageJson.exports !== undefined) {
		return analyzePackageExportsAsync(packageJson.exports, fsAccess);
	}

	// Fallback to legacy for packages without exports
	return resolveLegacyMainAsync(packageJson, fsAccess);
};

export const getPackageEntryPointsSync = (
	packagePath: string,
	fs = _fs,
): PackageEntryPoints => {
	const packageJsonString = fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8');
	const packageJson = JSON.parse(packageJsonString) as PackageJson;

	const fsAccess = createFsAccess(packagePath, fs);

	if (packageJson.exports !== undefined) {
		return analyzePackageExports(packageJson.exports, fsAccess);
	}

	// Fallback to legacy for packages without exports
	return resolveLegacyMain(packageJson, fsAccess);
};
