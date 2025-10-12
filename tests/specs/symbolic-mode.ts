import { testSuite, expect } from 'manten';
import { analyzeExports } from '#pkg-entry-points';

export default testSuite(({ describe }) => {
	describe('symbolic mode', ({ test }) => {
		test('wildcard patterns return pattern with * marker', () => {
			const result = analyzeExports({
				'./dist/*.js': './dist/*.js',
			});

			expect(result).toStrictEqual({
				'./dist/*.js': [[['default'], './dist/*.js']],
			});
		});

		test('static paths accepted without validation', () => {
			const result = analyzeExports({
				'.': './index.js',
				'./utils': './utils.js',
			});

			expect(result).toStrictEqual({
				'.': [[['default'], './index.js']],
				'./utils': [[['default'], './utils.js']],
			});
		});

		test('multiple wildcards in pattern', () => {
			const result = analyzeExports({
				'./dir/*/file-*-*.js': './dir/*/file-*-*.js',
			});

			expect(result).toStrictEqual({
				'./dir/*/file-*-*.js': [[['default'], './dir/*/file-*-*.js']],
			});
		});

		test('nested conditions in symbolic mode', () => {
			const result = analyzeExports({
				'.': {
					import: './index.mjs',
					require: './index.cjs',
				},
			});

			expect(result).toStrictEqual({
				'.': [
					[['import'], './index.mjs'],
					[['require'], './index.cjs'],
				],
			});
		});

		test('empty packageFiles array behaves like undefined', () => {
			const withEmpty = analyzeExports({ './dist/*.js': './dist/*.js' }, []);
			const withUndefined = analyzeExports({ './dist/*.js': './dist/*.js' });

			expect(withEmpty).toStrictEqual(withUndefined);
		});

		test('conditional exports with wildcards', () => {
			const result = analyzeExports({
				'./features/*': {
					import: './esm/features/*.mjs',
					require: './cjs/features/*.cjs',
				},
			});

			expect(result).toStrictEqual({
				'./features/*': [
					[['import'], './esm/features/*.mjs'],
					[['require'], './cjs/features/*.cjs'],
				],
			});
		});

		test('fallback arrays with wildcards', () => {
			const result = analyzeExports({
				'.': [
					'./missing/*.js',
					'./fallback.js',
				],
			});

			// In symbolic mode, wildcards are returned as-is (first item wins)
			// Fallback logic doesn't apply because we can't determine if wildcards match
			expect(result).toStrictEqual({
				'.': [
					[['default'], './missing/*.js'],
				],
			});
		});

		test('null exports in symbolic mode', () => {
			const result = analyzeExports({
				'./internal/*': null,
			});

			expect(result).toStrictEqual({});
		});

		test('concrete mode validates file existence', () => {
			const result = analyzeExports(
				{
					'.': './index.js',
					'./utils': './utils.js',
					'./missing': './missing.js',
				},
				['./index.js', './utils.js'],
			);

			expect(result).toStrictEqual({
				'.': [[['default'], './index.js']],
				'./utils': [[['default'], './utils.js']],
			});
		});

		test('concrete mode matches wildcards against files', () => {
			const result = analyzeExports(
				{ './dist/*.js': './dist/*.js' },
				['./dist/index.js', './dist/utils.js'],
			);

			expect(result).toStrictEqual({
				'./dist/index.js': [[['default'], './dist/index.js']],
				'./dist/utils.js': [[['default'], './dist/utils.js']],
			});
		});
	});
});
