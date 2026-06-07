import type _fs from 'fs';
import path from 'path';

const stripTrailingSeparator = (
	directoryPath: string,
) => (
	directoryPath.endsWith(path.sep)
		? directoryPath.slice(0, -1)
		: directoryPath
);

/**
 * Recursively walk a directory, collecting files as `./`-relative paths.
 *
 * Manual walk (rather than `readdir({ recursive: true })`) so we can:
 * - prune `node_modules` only at the package root, without descending into it
 *   (files under a *nested* `node_modules` are still listed, as before)
 * - skip symlinks consistently across sync and async (recursive `readdirSync`
 *   followed symlinked directories; async `readdir` did not)
 * - build paths by concatenation instead of normalizing every entry
 *
 * `relativePrefix` is the path from the package root to `absoluteDirectory`,
 * with a trailing separator (empty at the root). The root `node_modules` is
 * the one whose `relativePrefix` is empty.
 */
export const getAllFiles = async (
	fs: Pick<typeof _fs.promises, 'readdir'>,
	directoryPath: string,
): Promise<string[]> => {
	const result: string[] = [];

	const walk = async (
		absoluteDirectory: string,
		relativePrefix: string,
	): Promise<void> => {
		const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (relativePrefix === '' && entry.name === 'node_modules') {
					continue;
				}
				await walk(
					`${absoluteDirectory}${path.sep}${entry.name}`,
					`${relativePrefix}${entry.name}${path.sep}`,
				);
			} else if (entry.isFile()) {
				result.push(`./${relativePrefix}${entry.name}`);
			}
		}
	};

	await walk(stripTrailingSeparator(directoryPath), '');
	return result;
};

export const getAllFilesSync = (
	fs: Pick<typeof _fs, 'readdirSync'>,
	directoryPath: string,
): string[] => {
	const result: string[] = [];

	const walk = (
		absoluteDirectory: string,
		relativePrefix: string,
	): void => {
		const entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (relativePrefix === '' && entry.name === 'node_modules') {
					continue;
				}
				walk(
					`${absoluteDirectory}${path.sep}${entry.name}`,
					`${relativePrefix}${entry.name}${path.sep}`,
				);
			} else if (entry.isFile()) {
				result.push(`./${relativePrefix}${entry.name}`);
			}
		}
	};

	walk(stripTrailingSeparator(directoryPath), '');
	return result;
};
