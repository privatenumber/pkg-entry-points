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
	});
});
