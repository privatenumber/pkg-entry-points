import _fs from 'fs';
import path from 'path';
import type { PackageJson } from 'type-fest';
import { getAllFiles, getAllFilesSync } from './utils/get-all-files.js';
import { analyzeLegacyExports } from './legacy-resolver.js';
import type { PackageEntryPoints } from './types.js';
import { analyzePackageExports, analyzePackageExportsAsync } from './analyze-package-exports.js';

// Export new API
export { analyzePackageExports };
export type { FileSystemAccess, AsyncFileSystemAccess } from './analyze-package-exports.js';

export const getPackageEntryPoints = async (
	packagePath: string,
	fs = _fs.promises,
): Promise<PackageEntryPoints> => {
	const packageJsonString = await fs.readFile(path.join(packagePath, 'package.json'), 'utf8');
	const packageJson = JSON.parse(packageJsonString) as PackageJson;

	if (packageJson.exports !== undefined) {
		const fsAccess = {
			async fileExists(filePath: string): Promise<boolean> {
				try {
					const fullPath = path.join(packagePath, filePath);
					const stat = await fs.stat(fullPath);
					return stat.isFile();
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
		};

		return analyzePackageExportsAsync(packageJson.exports, fsAccess);
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
		const fsAccess = {
			fileExists(filePath: string): boolean {
				try {
					const fullPath = path.join(packagePath, filePath);
					return fs.statSync(fullPath).isFile();
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
		};

		return analyzePackageExports(packageJson.exports, fsAccess);
	}

	// Fallback to legacy for packages without exports
	const packageFiles = getAllFilesSync(fs, packagePath);
	return analyzeLegacyExports(packageJson, packageFiles);
};
