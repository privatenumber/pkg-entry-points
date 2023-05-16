import path from 'path';
import { createFixture, type FileTree } from 'fs-fixture';
import type { PackageJson } from 'type-fest';
import { execaNode } from 'execa';

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
			`console.log(await import.meta.resolve(${JSON.stringify(specifier)}));`,
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
