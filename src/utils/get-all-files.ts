import type _fs from 'fs';
import path from 'path';

/**
 * Recursively list all files in a directory.
 *
 * Required for legacy packages (without exports field) where every JS file
 * is a potential entry point. Cannot be made lazy without breaking the contract.
 *
 * Uses recursive readdir (Node 20.1.0+) to get all files in a single syscall.
 */
export const getAllFiles = async (
	fs: Pick<typeof _fs.promises, 'readdir'>,
	directoryPath: string,
): Promise<string[]> => {
	const entries = await fs.readdir(directoryPath, {
		recursive: true,
		withFileTypes: true,
	});

	return entries
		.filter((entry) => {
			if (!entry.isFile()) {
				return false;
			}

			const relativePath = path.relative(directoryPath, entry.parentPath);
			return !relativePath.split(path.sep).includes('node_modules');
		})
		.map(entry => `./${path.join(path.relative(directoryPath, entry.parentPath), entry.name)}`);
};

/**
 * Synchronous version of getAllFiles.
 *
 * Required for legacy packages (without exports field) where every JS file
 * is a potential entry point. Cannot be made lazy without breaking the contract.
 *
 * Uses recursive readdir (Node 20.1.0+) to get all files in a single syscall.
 */
export const getAllFilesSync = (
	fs: Pick<typeof _fs, 'readdirSync'>,
	directoryPath: string,
): string[] => {
	const entries = fs.readdirSync(directoryPath, {
		recursive: true,
		withFileTypes: true,
	});

	return entries
		.filter((entry) => {
			if (!entry.isFile()) {
				return false;
			}

			const relativePath = path.relative(directoryPath, entry.parentPath);
			return !relativePath.split(path.sep).includes('node_modules');
		})
		.map(entry => `./${path.join(path.relative(directoryPath, entry.parentPath), entry.name)}`);
};
