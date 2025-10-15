import type { PackageJson } from 'type-fest';

export type PackageJsonWithName = PackageJson & { name: string };
