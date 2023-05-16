import _fs from 'fs';
import path from 'path';

export const getAllFiles = async (
	fs: Pick<typeof _fs.promises, 'readdir' | 'stat'>,
	directoryPath: string,
	dontShortenPath?: boolean,
): Promise<string[]> => {
	const directoryFiles = await fs.readdir(directoryPath);
	const fileTree = await Promise.all(
		directoryFiles.map(async (fileName) => {
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
