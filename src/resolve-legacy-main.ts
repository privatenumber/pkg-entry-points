import type { PackageJson } from 'type-fest';
import type { ConditionToPath, PackageEntryPoints } from './types.js';
import type { AsyncFileSystemAccess, FileSystemAccess } from './create-fs-access.js';

const legacyCondition = (
	filePath: string,
) => [[['default'], filePath] as ConditionToPath];

export const resolveLegacyMain = (
	packageJson: PackageJson,
	fs: FileSystemAccess,
): PackageEntryPoints => {
	const jsExtension = /\.(?:json|[cm]?js|d\.ts)$/;
	const packageFiles = fs.readdirAll('.');
	const legacyExports = Object.fromEntries(
		packageFiles
			.filter(filePath => jsExtension.test(filePath))
			.map(filePath => [
				filePath,
				legacyCondition(filePath),
			]),
	);

	let packageMain = packageJson.main ?? './index.js';
	if (packageMain[0] !== '.') {
		packageMain = `./${packageMain}`;
	}

	for (const extension of ['', '.js', '.json']) {
		const target = packageMain + extension;
		if (packageFiles.includes(target)) {
			legacyExports['.'] = legacyCondition(target);
			legacyExports[target] = legacyCondition(target);
			break;
		}
	}

	return legacyExports;
};

export const resolveLegacyMainAsync = async (
	packageJson: PackageJson,
	fs: AsyncFileSystemAccess,
): Promise<PackageEntryPoints> => {
	const jsExtension = /\.(?:json|[cm]?js|d\.ts)$/;
	const packageFiles = await fs.readdirAll('.');
	const legacyExports = Object.fromEntries(
		packageFiles
			.filter(filePath => jsExtension.test(filePath))
			.map(filePath => [
				filePath,
				legacyCondition(filePath),
			]),
	);

	let packageMain = packageJson.main ?? './index.js';
	if (packageMain[0] !== '.') {
		packageMain = `./${packageMain}`;
	}

	for (const extension of ['', '.js', '.json']) {
		const target = packageMain + extension;
		if (packageFiles.includes(target)) {
			legacyExports['.'] = legacyCondition(target);
			legacyExports[target] = legacyCondition(target);
			break;
		}
	}

	return legacyExports;
};
