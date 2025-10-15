import type { PackageJsonWithName } from './utils/parse-package-json.js';

export const basic ={
    name: 'example-package',
    exports: {
        '.': './index.js',
        './utils': './utils.js',
    },
} satisfies PackageJsonWithName;

export const wildcardDanger = {
    name: 'dangerous-wildcards',
    exports: {
        './*': './dist/*.js',
    },
} satisfies PackageJsonWithName;

export const wildcardSafe = {
    name: 'safe-wildcards',
    exports: {
        './features/*': './dist/features/*/index.js',
    },
} satisfies PackageJsonWithName;
