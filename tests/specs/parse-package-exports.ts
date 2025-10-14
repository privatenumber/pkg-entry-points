import { testSuite, expect } from 'manten';
import { parsePackageExports } from '#pkg-entry-points';

export default testSuite(({ describe }) => {
	describe('parsePackageExports', ({ test }) => {
		test('string export', () => {
			const result = parsePackageExports('./index.js');

			expect(result).toStrictEqual([
				{
					subpath: '.',
					target: './index.js',
					conditions: ['default'],
				},
			]);
		});

		test('null export (should filter out)', () => {
			const result = parsePackageExports(null);

			expect(result).toStrictEqual([]);
		});

		test('empty object', () => {
			const result = parsePackageExports({});

			expect(result).toStrictEqual([]);
		});

		test('conditions object', () => {
			const result = parsePackageExports({
				import: './index.mjs',
				require: './index.cjs',
			});

			expect(result).toStrictEqual([
				{
					subpath: '.',
					target: './index.mjs',
					conditions: ['import'],
				},
				{
					subpath: '.',
					target: './index.cjs',
					conditions: ['require'],
				},
			]);
		});

		test('nested conditions', () => {
			const result = parsePackageExports({
				node: {
					import: './node.mjs',
					require: './node.cjs',
				},
				default: './index.js',
			});

			expect(result).toStrictEqual([
				{
					subpath: '.',
					target: './node.mjs',
					conditions: ['import', 'node'],
				},
				{
					subpath: '.',
					target: './node.cjs',
					conditions: ['node', 'require'],
				},
				{
					subpath: '.',
					target: './index.js',
					conditions: ['default'],
				},
			]);
		});

		test('multiple subpaths', () => {
			const result = parsePackageExports({
				'.': './index.js',
				'./utils': './utils.js',
				'./package.json': './package.json',
			});

			expect(result).toStrictEqual([
				{
					subpath: '.',
					target: './index.js',
					conditions: ['default'],
				},
				{
					subpath: './utils',
					target: './utils.js',
					conditions: ['default'],
				},
				{
					subpath: './package.json',
					target: './package.json',
					conditions: ['default'],
				},
			]);
		});

		test('wildcard subpath', () => {
			const result = parsePackageExports({
				'./components/*': './dist/components/*.js',
			});

			expect(result).toStrictEqual([
				{
					subpath: ['./components/', ''],
					target: ['./dist/components/', '.js'],
					conditions: ['default'],
				},
			]);
		});

		test('multiple wildcards in target', () => {
			const result = parsePackageExports({
				'./features/*': './dist/*/*/index.js',
			});

			expect(result).toStrictEqual([
				{
					subpath: ['./features/', ''],
					target: ['./dist/', '/', '/index.js'],
					conditions: ['default'],
				},
			]);
		});

		test('throws on multiple wildcards in subpath', () => {
			expect(() => {
				parsePackageExports({
					'./*/*': './dist/index.js',
				});
			}).toThrow('Subpath pattern can contain at most one wildcard: ./*/*');
		});
	});
});
