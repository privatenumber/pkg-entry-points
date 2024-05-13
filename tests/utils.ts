import path from 'path';
import { createFixture, type FileTree } from 'fs-fixture';
import type { PackageJson } from 'type-fest';
import { execaNode } from 'execa';
import { getPackageEntryPoints, getPackageEntryPointsSync } from '#pkg-entry-points';

export const createPkgJson = (
	pkgJson: PackageJson.PackageJsonStandard,
) => JSON.stringify(pkgJson);

export const createPackage = async (
	fileTree: FileTree,
) => {
	const fixture = await createFixture({
		node_modules: fileTree,
	});

	const assertSubpath = async (
		specifier: string,
		conditions: string[],
	) => {
		await fixture.writeFile(
			'index.mjs',
			`
			import fs from 'fs/promises';
			const resolved = import.meta.resolve(${JSON.stringify(specifier)});
			const exists = await fs.access(new URL(resolved)).then(() => true, () => false);
			if (!exists) {
				throw new Error('ERR_MODULE_NOT_FOUND');
			}
			console.log(resolved);
			`,
		);

		const { stdout } = await execaNode('./index.mjs', [], {
			cwd: fixture.path,
			nodeOptions: [
				'--experimental-import-meta-resolve',
				...conditions.flatMap(c => ['-C', c]),
			],
		});

		return stdout;
	};

	return {
		fixture,
		packagePath: path.join(fixture.path, 'node_modules/pkg'),
		assertSubpath,
	};
};

export const testScenarios = [
	{ scenario: 'async', getPackageEntryPoints },
	{ scenario: 'sync', getPackageEntryPoints: getPackageEntryPointsSync },
];
