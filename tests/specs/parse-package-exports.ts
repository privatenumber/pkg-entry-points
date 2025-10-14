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
	});
});
