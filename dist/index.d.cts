import _fs from 'fs';

type ConditionToPath = [conditions: string[], internalPath: string];
type PackageEntryPoints = {
    [subpath: string]: ConditionToPath[];
};
declare const getPackageEntryPoints: (packagePath: string, fs?: typeof _fs.promises) => Promise<PackageEntryPoints>;

export { PackageEntryPoints, getPackageEntryPoints };
