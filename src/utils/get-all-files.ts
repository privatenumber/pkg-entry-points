import type _fs from 'fs';
import path from 'path';

const nodeModulesPath = `node_modules${path.sep}`;

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

	const result: string[] = [];
	for (const entry of entries) {
		if (!entry.isFile()) {
			continue;
		}

		const relativeParentPath = path.relative(directoryPath, entry.parentPath);
		if (relativeParentPath.startsWith(nodeModulesPath)) {
			continue;
		}

		result.push(`./${path.join(relativeParentPath, entry.name)}`);
	}

	return result;
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

	const result: string[] = [];
	for (const entry of entries) {
		if (!entry.isFile()) {
			continue;
		}

		const relativeParentPath = path.relative(directoryPath, entry.parentPath);
		if (relativeParentPath.startsWith(nodeModulesPath)) {
			continue;
		}

		result.push(`./${path.join(relativeParentPath, entry.name)}`);
	}

	return result;
};
