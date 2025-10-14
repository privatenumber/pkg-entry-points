/**
 * Filesystem abstraction for lazy file checking.
 *
 * Instead of eagerly scanning all files, this interface allows
 * the analyzer to check only the files referenced in exports.
 */

/**
 * Synchronous filesystem operations
 */
export type FileSystemAccess = {
	/**
	 * Check if a specific file exists
	 * Called for direct export targets like "./file.js"
	 */
	fileExists(path: string): boolean;

	/**
	 * List files in a directory (non-recursive)
	 * Called only for wildcard patterns like "./src/*.js"
	 *
	 * @param directoryPath - Directory to list (e.g., "./src")
	 * @returns Array of file paths relative to package root
	 */
	listDirectory(directoryPath: string): string[];
};

/**
 * Asynchronous filesystem operations
 */
export type AsyncFileSystemAccess = {
	fileExists(path: string): Promise<boolean>;
	listDirectory(directoryPath: string): Promise<string[]>;
};

/**
 * Helper to create FileSystemAccess from Node.js fs
 */
export function createNodeFileSystem(
	fs: typeof import('fs'),
	packagePath: string,
): FileSystemAccess {
	return {
		fileExists(filePath: string) {
			try {
				const fullPath = require('path').join(packagePath, filePath);
				const stats = fs.statSync(fullPath);
				return stats.isFile();
			} catch {
				return false;
			}
		},

		listDirectory(directoryPath: string) {
			try {
				const fullPath = require('path').join(packagePath, directoryPath);
				const entries = fs.readdirSync(fullPath);

				return entries
					.map(entry => {
						const entryPath = require('path').join(directoryPath, entry);
						const fullEntryPath = require('path').join(packagePath, entryPath);
						try {
							const stats = fs.statSync(fullEntryPath);
							return stats.isFile() ? entryPath : null;
						} catch {
							return null;
						}
					})
					.filter((entry): entry is string => entry !== null);
			} catch {
				return [];
			}
		},
	};
}

/**
 * Helper to create AsyncFileSystemAccess from Node.js fs.promises
 */
export function createAsyncNodeFileSystem(
	fs: typeof import('fs').promises,
	packagePath: string,
): AsyncFileSystemAccess {
	return {
		async fileExists(filePath: string) {
			try {
				const fullPath = require('path').join(packagePath, filePath);
				const stats = await fs.stat(fullPath);
				return stats.isFile();
			} catch {
				return false;
			}
		},

		async listDirectory(directoryPath: string) {
			try {
				const fullPath = require('path').join(packagePath, directoryPath);
				const entries = await fs.readdir(fullPath);

				const results = await Promise.all(
					entries.map(async entry => {
						const entryPath = require('path').join(directoryPath, entry);
						const fullEntryPath = require('path').join(packagePath, entryPath);
						try {
							const stats = await fs.stat(fullEntryPath);
							return stats.isFile() ? entryPath : null;
						} catch {
							return null;
						}
					}),
				);

				return results.filter((entry): entry is string => entry !== null);
			} catch {
				return [];
			}
		},
	};
}
