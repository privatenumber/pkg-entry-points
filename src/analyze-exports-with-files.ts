import { createPathMatcher, pathMatches } from './utils/path-matcher.js';
import type { PackageEntryPoints, ParsedExport } from './types.js';

export const analyzeExportsWithFiles = (
	parsed: ParsedExport[],
	packageFiles: string[],
): PackageEntryPoints => {

	// Build map of subpath -> conditions -> file path
	// Track whether each entry came from a wildcard or static subpath
	const entries = new Map<string, Map<string, { path: string | null; isWildcard: boolean }>>();
	const wildcardBlocks: Array<{ subpath: string[]; conditions: string }> = [];

	for (const entry of parsed) {
		const isWildcard = Array.isArray(entry.subpath);
		const conditionsKey = JSON.stringify(entry.conditions);

		// Handle null targets - track wildcard blocks, store static blocks
		if (entry.target === null) {
			if (isWildcard) {
				wildcardBlocks.push({ subpath: entry.subpath, conditions: conditionsKey });
			} else {
				const subpathMap = entries.get(entry.subpath) ?? new Map();
				const existing = subpathMap.get(conditionsKey);
				// Static null overrides wildcard entries
				if (!existing || existing.isWildcard) {
					subpathMap.set(conditionsKey, { path: null, isWildcard: false });
					entries.set(entry.subpath, subpathMap);
				}
			}
			continue;
		}

		// Expand wildcards or validate static paths
		const filesToAdd: Array<{ subpath: string; file: string; isWildcard: boolean }> = [];

		if (isWildcard) {
			const targetPattern = Array.isArray(entry.target) ? entry.target.join('*') : entry.target;
			const targetMatcher = createPathMatcher(targetPattern);

			if (Array.isArray(entry.target)) {
				// Dynamic target - match files
				for (const file of packageFiles) {
					const match = pathMatches(targetMatcher, file);
					if (match !== undefined) {
						filesToAdd.push({
							subpath: entry.subpath.join(match),
							file,
							isWildcard: true,
						});
					}
				}
			} else {
				// Static target with wildcard subpath - use '_'
				if (packageFiles.includes(entry.target)) {
					filesToAdd.push({
						subpath: entry.subpath.join('_'),
						file: entry.target,
						isWildcard: true,
					});
				}
			}
		} else {
			// Static subpath
			if (Array.isArray(entry.target)) {
				// Target has wildcard - find first matching file
				const targetMatcher = createPathMatcher(entry.target.join('*'));
				for (const file of packageFiles) {
					if (pathMatches(targetMatcher, file) !== undefined) {
						filesToAdd.push({ subpath: entry.subpath, file, isWildcard: false });
						break;
					}
				}
			} else {
				// Both static
				if (packageFiles.includes(entry.target)) {
					filesToAdd.push({ subpath: entry.subpath, file: entry.target, isWildcard: false });
				}
			}
		}

		// Add files with precedence: static always wins over wildcard
		for (const { subpath, file, isWildcard: fromWildcard } of filesToAdd) {
			const subpathMap = entries.get(subpath) ?? new Map();
			const existing = subpathMap.get(conditionsKey);

			// Static overrides wildcard; otherwise first wins
			if (!existing || (existing.isWildcard && !fromWildcard)) {
				subpathMap.set(conditionsKey, { path: file, isWildcard: fromWildcard });
				entries.set(subpath, subpathMap);
			}
		}
	}

	// Build final result, filtering nulls and wildcard blocks
	const result: PackageEntryPoints = {};

	for (const [subpath, conditionsMap] of entries) {
		const conditions = Array.from(conditionsMap.entries())
			.filter(([conditionsKey, { path }]) => {
				if (path === null) return false;

				// Check wildcard blocks
				for (const block of wildcardBlocks) {
					const matcher = createPathMatcher(block.subpath.join('*'));
					if (pathMatches(matcher, subpath) !== undefined && conditionsKey === block.conditions) {
						return false;
					}
				}
				return true;
			})
			.map(([conditionsKey, { path }]) => [JSON.parse(conditionsKey), path!] as [string[], string])
			.sort(([a], [b]) => a.length - b.length);

		if (conditions.length > 0) {
			result[subpath] = conditions;
		}
	}

	return result;
};
