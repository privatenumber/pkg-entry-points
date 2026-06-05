import type _fs from 'fs';
import path from 'path';

const nodeModulesPath = `node_modules${path.sep}`;

type Dirent = {
	name: string;
	parentPath: string;
	isFile: () => boolean;
};

/**
 * Convert recursive readdir entries to package-relative paths.
 *
 * In a recursive listing, every `entry.parentPath` is `directoryPath` itself or
 * a descendant of it, so the package-relative path is a plain string slice and
 * the entry path is a concatenation. This avoids `path.relative`/`path.join`
 * normalizing every entry, which dominates the cost of scanning large packages.
 */
const collectFiles = (
	entries: Dirent[],
	directoryPath: string,
): string[] => {
	// Offset of the first character after `directoryPath` and its separator.
	const baseLength = (
		directoryPath.endsWith(path.sep)
			? directoryPath.length - 1
			: directoryPath.length
	) + 1;

	const result: string[] = [];
	for (const entry of entries) {
		if (!entry.isFile()) {
			continue;
		}

		const { parentPath } = entry;
		const relativeParentPath = (
			parentPath.length > baseLength
				? parentPath.slice(baseLength)
				: ''
		);
		if (relativeParentPath.startsWith(nodeModulesPath)) {
			continue;
		}

		result.push(
			relativeParentPath
				? `./${relativeParentPath}${path.sep}${entry.name}`
				: `./${entry.name}`,
		);
	}

	return result;
};

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

	return collectFiles(entries, directoryPath);
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

	return collectFiles(entries, directoryPath);
};
