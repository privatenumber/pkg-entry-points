import type _fs from 'fs';
import path from 'path';

/**
 * Recursively list all files in a directory.
 *
 * Required for legacy packages (without exports field) where every JS file
 * is a potential entry point. Cannot be made lazy without breaking the contract.
 */
export const getAllFiles = async (
	fs: Pick<typeof _fs.promises, 'readdir' | 'stat'>,
	directoryPath: string,
	dontShortenPath?: boolean,
): Promise<string[]> => {
	const directoryFiles = await fs.readdir(directoryPath);
	const fileTree = await Promise.all(
		directoryFiles.filter(fileName => fileName !== 'node_modules').map(async (fileName) => {
			const filePath = path.join(directoryPath, fileName);
			const stat = await fs.stat(filePath);

			if (stat.isDirectory()) {
				const files = await getAllFiles(fs, filePath, true);
				return (
					dontShortenPath
						? files
						: files.map(file => `./${path.relative(directoryPath, file)}`)
				);
			}

			return (
				dontShortenPath
					? filePath
					: `./${path.relative(directoryPath, filePath)}`
			);
		}),
	);

	return fileTree.flat();
};

/**
 * Synchronous version of getAllFiles.
 *
 * Required for legacy packages (without exports field) where every JS file
 * is a potential entry point. Cannot be made lazy without breaking the contract.
 */
export const getAllFilesSync = (
	fs: Pick<typeof _fs, 'readdirSync' | 'statSync'>,
	directoryPath: string,
	dontShortenPath?: boolean,
): string[] => {
	const directoryFiles = fs.readdirSync(directoryPath);
	const fileTree = directoryFiles.filter(fileName => fileName !== 'node_modules').map((fileName) => {
		const filePath = path.join(directoryPath, fileName);
		const stat = fs.statSync(filePath);

		if (stat.isDirectory()) {
			const files = getAllFilesSync(fs, filePath, true);
			return (
				dontShortenPath
					? files
					: files.map(file => `./${path.relative(directoryPath, file)}`)
			);
		}

		return (
			dontShortenPath
				? filePath
				: `./${path.relative(directoryPath, filePath)}`
		);
	});

	return fileTree.flat();
};
