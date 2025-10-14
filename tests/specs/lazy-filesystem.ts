import { testSuite, expect } from 'manten';
import type { FileSystemAccess } from '../../src/lazy-analyzer.js';
import { analyzePackageExportsLazy } from '../../src/index.js';

export default testSuite(({ describe }) => {
	describe('lazy filesystem access', ({ test }) => {
		test('only checks files referenced in exports', () => {
			const checkedPaths: string[] = [];
			const listedDirectories: string[] = [];

			const mockFs: FileSystemAccess = {
				fileExists(path: string) {
					checkedPaths.push(path);
					return path === './index.js' || path === './utils.js';
				},
				listDirectory(path: string) {
					listedDirectories.push(path);
					return [];
				},
			};

			const result = analyzePackageExportsLazy(
				{
					'.': './index.js',
					'./utils': './utils.js',
				},
				mockFs,
			);

			// Should only check the two files in exports
			expect(checkedPaths).toStrictEqual([
				'./index.js',
				'./utils.js',
			]);

			// Should not list any directories (no wildcards)
			expect(listedDirectories).toStrictEqual([]);

			// Should return the exports
			expect(result).toStrictEqual({
				'.': [[['default'], './index.js']],
				'./utils': [[['default'], './utils.js']],
			});
		});

		test('lists directory only for wildcard patterns', () => {
			const checkedPaths: string[] = [];
			const listedDirectories: string[] = [];

			const mockFs: FileSystemAccess = {
				fileExists(path: string) {
					checkedPaths.push(path);
					return true;
				},
				listDirectory(path: string) {
					listedDirectories.push(path);
					// Simulate ./src containing two files
					if (path === './src') {
						return ['./src/a.js', './src/b.js'];
					}
					return [];
				},
			};

			const result = analyzePackageExportsLazy(
				{
					'./*': './src/*.js',
				},
				mockFs,
			);

			// Should not check individual files (wildcard delegates to listDirectory)
			expect(checkedPaths).toStrictEqual([]);

			// Should list the ./src directory once
			expect(listedDirectories).toStrictEqual(['./src']);

			// Should return the matched files
			expect(result).toStrictEqual({
				'./a': [[['default'], './src/a.js']],
				'./b': [[['default'], './src/b.js']],
			});
		});

		test('skips missing files', () => {
			const mockFs: FileSystemAccess = {
				fileExists(path: string) {
					// Only ./index.js exists
					return path === './index.js';
				},
				listDirectory: () => [],
			};

			const result = analyzePackageExportsLazy(
				{
					'.': './index.js',
					'./missing': './missing.js',
				},
				mockFs,
			);

			// Should only include the existing file
			expect(result).toStrictEqual({
				'.': [[['default'], './index.js']],
			});
		});
	});
});
