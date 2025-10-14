import _fs from 'fs';
import path from 'path';
import type { PackageJson } from 'type-fest';
import { resolveLegacyMain, resolveLegacyMainAsync } from './resolve-legacy-main.js';
import type { PackageEntryPoints } from './types.js';
import {
	analyzePackageExports,
	analyzePackageExportsAsync,
	type AsyncFileSystemAccess,
	type FileSystemAccess,
} from './analyze-package-exports.js';

// Export new API
export { analyzePackageExports };
export type { FileSystemAccess, AsyncFileSystemAccess } from './analyze-package-exports.js';

/**
 * Create async filesystem access adapter for a package directory
 */
const createAsyncFsAccess = (
	packagePath: string,
	fs: typeof _fs.promises,
): AsyncFileSystemAccess => ({
	async fileExists(filePath: string): Promise<boolean> {
		try {
			const fullPath = path.join(packagePath, filePath);
			await fs.access(fullPath);
			return true;
		} catch {
			return false;
		}
	},
	async listDirectory(directoryPath: string): Promise<string[]> {
		try {
			const fullPath = path.join(packagePath, directoryPath);
			const entries = await fs.readdir(fullPath);

			const results = await Promise.all(entries.filter(entry => entry !== 'node_modules').map(async (entry) => {
				let entryPath = path.join(directoryPath, entry);
				if (!entryPath.startsWith('./')) {
					entryPath = `./${entryPath}`;
				}

				const fullEntryPath = path.join(packagePath, entryPath);
				try {
					const stat = await fs.stat(fullEntryPath);
					if (stat.isDirectory()) {
						return await this.listDirectory(entryPath);
					}

					if (stat.isFile()) {
						return [entryPath];
					}

					return [];
				} catch {
					return [];
				}
			}));

			return results.flat().filter((p): p is string => p !== null);
		} catch {
			return [];
		}
	},
});

/**
 * Create sync filesystem access adapter for a package directory
 */
const createFsAccess = (
	packagePath: string,
	fs: typeof _fs,
): FileSystemAccess => ({
	fileExists(filePath: string): boolean {
		try {
			const fullPath = path.join(packagePath, filePath);
			fs.accessSync(fullPath);
			return true;
		} catch {
			return false;
		}
	},
	listDirectory(directoryPath: string): string[] {
		try {
			const fullPath = path.join(packagePath, directoryPath);
			const entries = fs.readdirSync(fullPath);

			return entries.filter(entry => entry !== 'node_modules').flatMap((entry) => {
				let entryPath = path.join(directoryPath, entry);
				if (!entryPath.startsWith('./')) {
					entryPath = `./${entryPath}`;
				}

				const fullEntryPath = path.join(packagePath, entryPath);
				try {
					const stat = fs.statSync(fullEntryPath);
					if (stat.isDirectory()) {
						return this.listDirectory(entryPath);
					}

					if (stat.isFile()) {
						return [entryPath];
					}

					return [];
				} catch {
					return [];
				}
			}).filter((p): p is string => p !== null);
		} catch {
			return [];
		}
	},
});

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
