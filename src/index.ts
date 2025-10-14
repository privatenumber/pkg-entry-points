import _fs from 'fs';
import path from 'path';
import type { PackageJson } from 'type-fest';
import { getAllFiles, getAllFilesSync } from './utils/get-all-files.js';
import { analyzeLegacyExports } from './legacy-resolver.js';
import type { PackageEntryPoints } from './types.js';
import { analyzePackageExportsLazy, analyzePackageExportsLazyAsync } from './lazy-analyzer.js';

// Export new lazy API
export { analyzePackageExportsLazy };
export type { FileSystemAccess, AsyncFileSystemAccess } from './filesystem-access.js';

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
						.flatMap((entry) => {
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
