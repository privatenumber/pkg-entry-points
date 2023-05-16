import _fs from 'fs';

type ConditionToPath = [conditions: string[], internalPath: string];
type PkgExports = {
    [subpath: string]: ConditionToPath[];
};
declare const getPackageEntryPoints: (packagePath: string, fs?: typeof _fs.promises) => Promise<PkgExports>;

export { PkgExports, getPackageEntryPoints };
