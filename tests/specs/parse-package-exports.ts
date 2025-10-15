import { testSuite, expect } from 'manten';
import { parsePackageExports } from '#pkg-entry-points';

export default testSuite(({ describe }) => {
	describe('parsePackageExports', ({ test }) => {
		test('string export', () => {
			const { parsed, errors } = parsePackageExports('./index.js');

			expect(parsed).toStrictEqual([
				{
					subpath: '.',
					target: './index.js',
					conditions: ['default'],
				},
			]);
			expect(errors).toStrictEqual([]);
		});

		test('null export (creates block entry)', () => {
			const { parsed, errors } = parsePackageExports(null);

			expect(parsed).toStrictEqual([
				{
					subpath: '.',
					target: null,
					conditions: ['default'],
				},
			]);
			expect(errors).toStrictEqual([]);
		});

		test('empty object', () => {
			const { parsed, errors } = parsePackageExports({});

			expect(parsed).toStrictEqual([]);
			expect(errors).toStrictEqual([]);
		});

		test('conditions object', () => {
			const { parsed, errors } = parsePackageExports({
				import: './index.mjs',
				require: './index.cjs',
			});

			expect(parsed).toStrictEqual([
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
			expect(errors).toStrictEqual([]);
		});

		test('nested conditions', () => {
			const { parsed, errors } = parsePackageExports({
				node: {
					import: './node.mjs',
					require: './node.cjs',
				},
				default: './index.js',
			});

			expect(parsed).toStrictEqual([
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
			expect(errors).toStrictEqual([]);
		});

		test('multiple subpaths', () => {
			const { parsed, errors } = parsePackageExports({
				'.': './index.js',
				'./utils': './utils.js',
				'./package.json': './package.json',
			});

			expect(parsed).toStrictEqual([
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
			expect(errors).toStrictEqual([]);
		});

		test('wildcard subpath', () => {
			const { parsed, errors } = parsePackageExports({
				'./components/*': './dist/components/*.js',
			});

			expect(parsed).toStrictEqual([
				{
					subpath: ['./components/', ''],
					target: ['./dist/components/', '.js'],
					conditions: ['default'],
				},
			]);
			expect(errors).toStrictEqual([]);
		});

		test('multiple wildcards in target', () => {
			const { parsed, errors } = parsePackageExports({
				'./features/*': './dist/*/*/index.js',
			});

			expect(parsed).toStrictEqual([
				{
					subpath: ['./features/', ''],
					target: ['./dist/', '/', '/index.js'],
					conditions: ['default'],
				},
			]);
			expect(errors).toStrictEqual([]);
		});

		test('returns error on multiple wildcards in subpath', () => {
			const { parsed, errors } = parsePackageExports({
				'./*/*': './dist/index.js',
			});

			expect(parsed).toStrictEqual([]);
			expect(errors).toHaveLength(1);
			expect(errors[0].message).toBe('Subpath pattern can contain at most one wildcard: ./*/*');
		});

		test('fallback array', () => {
			const { parsed, errors } = parsePackageExports({
				'.': ['./modern.js', './fallback.js'],
			});

			expect(parsed).toStrictEqual([
				{
					subpath: '.',
					target: './modern.js',
					conditions: ['default'],
				},
				{
					subpath: '.',
					target: './fallback.js',
					conditions: ['default'],
				},
			]);
			expect(errors).toStrictEqual([]);
		});

		test('null in conditions object (creates block entry)', () => {
			const { parsed, errors } = parsePackageExports({
				'.': {
					import: './index.mjs',
					require: null,
				},
			});

			expect(parsed).toStrictEqual([
				{
					subpath: '.',
					target: './index.mjs',
					conditions: ['import'],
				},
				{
					subpath: '.',
					target: null,
					conditions: ['require'],
				},
			]);
			expect(errors).toStrictEqual([]);
		});

		test('complex exports with multiple features', () => {
			const { parsed, errors } = parsePackageExports({
				'.': {
					import: './index.mjs',
					require: './index.cjs',
				},
				'./utils': './utils.js',
				'./features/*': {
					node: './dist/node/*/index.js',
					default: './dist/browser/*/index.js',
				},
				'./private': null,
			});

			expect(parsed).toStrictEqual([
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
				{
					subpath: './utils',
					target: './utils.js',
					conditions: ['default'],
				},
				{
					subpath: ['./features/', ''],
					target: ['./dist/node/', '/index.js'],
					conditions: ['node'],
				},
				{
					subpath: ['./features/', ''],
					target: ['./dist/browser/', '/index.js'],
					conditions: ['default'],
				},
				{
					subpath: './private',
					target: null,
					conditions: ['default'],
				},
			]);
			expect(errors).toStrictEqual([]);
		});

		test('null blocks wildcard patterns', () => {
			const { parsed, errors } = parsePackageExports({
				'./dist/*': './dist/*',
				'./dist/internal/*': null,
			});

			expect(parsed).toStrictEqual([
				{
					subpath: ['./dist/', ''],
					target: ['./dist/', ''],
					conditions: ['default'],
				},
				{
					subpath: ['./dist/internal/', ''],
					target: null,
					conditions: ['default'],
				},
			]);
			expect(errors).toStrictEqual([]);
		});

		test('returns errors for invalid subpath keys (not starting with .)', () => {
			const { parsed, errors } = parsePackageExports({
				'./a': './dist/a.js',
				'./*': './dist/*.js',
				notSubPath: './notSubPath',
				'invalid-key': './invalid.js',
			});

			expect(parsed).toStrictEqual([
				{
					subpath: './a',
					target: './dist/a.js',
					conditions: ['default'],
				},
				{
					subpath: ['./', ''],
					target: ['./dist/', '.js'],
					conditions: ['default'],
				},
			]);
			expect(errors).toHaveLength(2);
			expect(errors[0].message).toBe('Invalid subpath "notSubPath": must start with "."');
			expect(errors[1].message).toBe('Invalid subpath "invalid-key": must start with "."');
		});
	});
});
