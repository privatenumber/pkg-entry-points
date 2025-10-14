import type _fs from 'fs';
import path from 'path';

export type FileSystemAccess = {
	fileExists(path: string): boolean;
	readdirAll(directoryPath: string): string[];
};

export type AsyncFileSystemAccess = {
	fileExists(path: string): Promise<boolean>;
	readdirAll(directoryPath: string): Promise<string[]>;
};

/**
 * Create async filesystem access adapter for a package directory
 */
export const createAsyncFsAccess = (
	packagePath: string,
	fs: typeof _fs.promises,
): AsyncFileSystemAccess => ({
	async fileExists(filePath: string): Promise<boolean> {
		const fullPath = path.join(packagePath, filePath);
		return await fs.access(fullPath).then(() => true, () => false);
	},
	async readdirAll(directoryPath: string): Promise<string[]> {
		const fullPath = path.join(packagePath, directoryPath);

		let entries: string[];
		try {
			entries = await fs.readdir(fullPath);
		} catch {
			// Directory doesn't exist or no permission
			return [];
		}

		const results = await Promise.all(entries.filter(entry => entry !== 'node_modules').map(async (entry) => {
			let entryPath = path.join(directoryPath, entry);
			if (!entryPath.startsWith('./')) {
				entryPath = `./${entryPath}`;
			}

			const fullEntryPath = path.join(packagePath, entryPath);

			try {
				const stat = await fs.stat(fullEntryPath);
				if (stat.isDirectory()) {
					return await this.readdirAll(entryPath);
				}

				if (stat.isFile()) {
					return [entryPath];
				}

				return [];
			} catch {
				// Entry was deleted between readdir and stat, or no permission
				return [];
			}
		}));

		return results.flat().filter((p): p is string => p !== null);
	},
});

/**
 * Create sync filesystem access adapter for a package directory
 */
export const createFsAccess = (
	packagePath: string,
	fs: typeof _fs,
): FileSystemAccess => ({
	fileExists(filePath: string): boolean {
		const fullPath = path.join(packagePath, filePath);
		return fs.existsSync(fullPath);
	},
	readdirAll(directoryPath: string): string[] {
		const fullPath = path.join(packagePath, directoryPath);

		let entries: string[];
		try {
			entries = fs.readdirSync(fullPath);
		} catch {
			// Directory doesn't exist or no permission
			return [];
		}

		return entries.filter(entry => entry !== 'node_modules').flatMap((entry) => {
			let entryPath = path.join(directoryPath, entry);
			if (!entryPath.startsWith('./')) {
				entryPath = `./${entryPath}`;
			}

			const fullEntryPath = path.join(packagePath, entryPath);

			try {
				const stat = fs.statSync(fullEntryPath);
				if (stat.isDirectory()) {
					return this.readdirAll(entryPath);
				}

				if (stat.isFile()) {
					return [entryPath];
				}

				return [];
			} catch {
				// Entry was deleted between readdir and stat, or no permission
				return [];
			}
		}).filter((p): p is string => p !== null);
	},
});
