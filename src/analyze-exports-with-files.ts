import type { PackageJson } from 'type-fest';
import { parsePackageExports } from './parse-package-exports.js';
import { createPathMatcher, pathMatches } from './utils/path-matcher.js';
import type { PackageEntryPoints } from './types.js';

export const analyzeExportsWithFiles = (
	exports: PackageJson.Exports,
	packageFiles: string[],
): PackageEntryPoints => {
	const parsed = parsePackageExports(exports);

	// Separate wildcard and static entries
	// Static entries override wildcard entries for the same subpath+conditions
	const wildcardEntries: {
		[subpath: string]: {
			[conditions: string]: string | null;
		};
	} = {};

	const staticEntries: {
		[subpath: string]: {
			[conditions: string]: string | null;
		};
	} = {};

	// Track wildcard blocks separately to apply later
	const wildcardBlocks: Array<{
		subpath: string[];
		conditions: string;
	}> = [];

	for (const entry of parsed) {
		const isWildcardSubpath = Array.isArray(entry.subpath);
		const conditionsKey = JSON.stringify(entry.conditions);

		// Handle null targets (blocks)
		if (entry.target === null) {
			if (isWildcardSubpath) {
				// Wildcard block - track for later application
				wildcardBlocks.push({
					subpath: entry.subpath,
					conditions: conditionsKey,
				});
				continue;
			} else {
				// Static block
				if (!staticEntries[entry.subpath]) {
					staticEntries[entry.subpath] = {};
				}

				// Only set if not already present (first wins within static)
				if (!Object.hasOwn(staticEntries[entry.subpath], conditionsKey)) {
					staticEntries[entry.subpath][conditionsKey] = null;
				}
			}
			continue;
		}

		if (isWildcardSubpath) {
			// Wildcard pattern - match against files
			const subpathPattern = entry.subpath.join('*');
			const targetPattern = Array.isArray(entry.target)
				? entry.target.join('*')
				: entry.target;

			const targetMatcher = createPathMatcher(targetPattern);

			// If target is static (no wildcard), use '_' as the replacement value
			const isTargetStatic = !Array.isArray(entry.target);

			if (isTargetStatic) {
				// Static target - check if file exists and use '_' for wildcard
				if (packageFiles.includes(entry.target as string)) {
					const subpath = entry.subpath.join('_');

					if (!wildcardEntries[subpath]) {
						wildcardEntries[subpath] = {};
					}

					// Only set if not already present (first wins within wildcards)
					if (!Object.hasOwn(wildcardEntries[subpath], conditionsKey)) {
						wildcardEntries[subpath][conditionsKey] = entry.target as string;
					}
				}
			} else {
				// Dynamic target - match against files
				for (const filePath of packageFiles) {
					const targetMatch = pathMatches(targetMatcher, filePath);
					if (targetMatch !== undefined) {
						// Reconstruct subpath with the matched value
						const subpath = entry.subpath.join(targetMatch);

						if (!wildcardEntries[subpath]) {
							wildcardEntries[subpath] = {};
						}

						// Only set if not already present (first wins within wildcards)
						if (!Object.hasOwn(wildcardEntries[subpath], conditionsKey)) {
							wildcardEntries[subpath][conditionsKey] = filePath;
						}
					}
				}
			}
		} else {
			// Static subpath
			if (Array.isArray(entry.target)) {
				// Target has wildcard (e.g., '.': './file-*.js')
				// Try to match target pattern against files
				const targetPattern = entry.target.join('*');
				const targetMatcher = createPathMatcher(targetPattern);

				for (const filePath of packageFiles) {
					const targetMatch = pathMatches(targetMatcher, filePath);
					if (targetMatch !== undefined) {
						// Found a matching file
						if (!staticEntries[entry.subpath]) {
							staticEntries[entry.subpath] = {};
						}

						// Only set if not already present (first wins within static)
						if (!Object.hasOwn(staticEntries[entry.subpath], conditionsKey)) {
							staticEntries[entry.subpath][conditionsKey] = filePath;
						}
						// For static subpath, only take the first match
						break;
					}
				}
			} else {
				// Static target - check file existence
				if (packageFiles.includes(entry.target)) {
					if (!staticEntries[entry.subpath]) {
						staticEntries[entry.subpath] = {};
					}

					// Only set if not already present (first wins within static)
					if (!Object.hasOwn(staticEntries[entry.subpath], conditionsKey)) {
						staticEntries[entry.subpath][conditionsKey] = entry.target;
					}
				}
			}
		}
	}

	// Merge: start with wildcard entries, then override with static entries
	const merged: {
		[subpath: string]: {
			[conditions: string]: string | null;
		};
	} = {};

	// Add all wildcard entries
	for (const subpath in wildcardEntries) {
		if (!Object.hasOwn(wildcardEntries, subpath)) {
			continue;
		}
		merged[subpath] = { ...wildcardEntries[subpath] };
	}

	// Override with static entries
	for (const subpath in staticEntries) {
		if (!Object.hasOwn(staticEntries, subpath)) {
			continue;
		}

		if (!merged[subpath]) {
			merged[subpath] = {};
		}

		// Static entries override wildcard entries
		for (const conditionsKey in staticEntries[subpath]) {
			if (!Object.hasOwn(staticEntries[subpath], conditionsKey)) {
				continue;
			}
			merged[subpath][conditionsKey] = staticEntries[subpath][conditionsKey];
		}
	}

	// Filter out null entries (blocks) and apply wildcard blocks
	const result: PackageEntryPoints = {};

	for (const subpath in merged) {
		if (!Object.hasOwn(merged, subpath)) {
			continue;
		}

		const conditionsEntries = Object.entries(merged[subpath])
			// Filter out null entries and wildcard blocks
			.filter(([conditionsKey, internalPath]) => {
				// Filter out static nulls
				if (internalPath === null) {
					return false;
				}

				// Check if this is blocked by a wildcard block
				for (const block of wildcardBlocks) {
					const blockMatcher = createPathMatcher(block.subpath.join('*'));
					if (pathMatches(blockMatcher, subpath) !== undefined && conditionsKey === block.conditions) {
						return false;
					}
				}

				return true;
			})
			.map(([conditionsKey, internalPath]) => [
				JSON.parse(conditionsKey) as string[],
				internalPath as string,
			] as [string[], string])
			.sort(([conditionsA], [conditionsB]) => conditionsA.length - conditionsB.length);

		if (conditionsEntries.length > 0) {
			result[subpath] = conditionsEntries;
		}
	}

	return result;
};
