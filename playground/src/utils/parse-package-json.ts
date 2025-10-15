import type { PackageJson } from 'type-fest';

export type PackageJsonWithName = PackageJson & { name: string };

export const parsePackageJson = (
	jsonString: string,
): PackageJsonWithName => {
	const parsed = JSON.parse(jsonString) as PackageJson;

	if (!parsed.name || typeof parsed.name !== 'string') {
		throw new Error('package.json must have a "name" property');
	}

	return parsed as PackageJsonWithName;
};
