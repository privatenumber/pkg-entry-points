# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`pkg-entry-points` is a utility library that extracts all entry-points from an npm package. It supports both modern `exports` field resolution (with conditions and wildcards) and legacy entry-point detection (via `main`, `module`, etc.).

## Development Commands

```bash
# Build the package (required before testing)
pnpm build

# Run tests (builds first, then runs manten test suite)
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint

# Development mode (watch and run tests with development conditions)
pnpm dev
```

## Architecture

### Core Algorithms

The library has two main code paths:

1. **Modern exports analysis** (`analyzeExportsWithFiles`)
   - Parses `package.json#exports` field
   - Recursively traverses condition objects to extract all possible subpath/condition combinations
   - Handles wildcards (`*`) by matching against actual package files
   - Filters out blocked exports (null conditions)
   - Returns map of subpath → array of [conditions, internalPath] tuples

2. **Legacy exports analysis** (`resolveLegacyMain` / `resolveLegacyMainAsync`)
   - Fallback for packages without `exports` field
   - Uses filesystem abstraction to list all `.js`, `.cjs`, `.mjs`, `.json`, `.d.ts` files
   - Resolves `main` field with implicit extension resolution (tries `main`, `main.js`, `main.json`)
   - Returns all files as entry-points with `['default']` condition

### Key Concepts

**Conditions**: Export conditions like `import`, `require`, `types`, `browser`, `node`, etc. The library tracks all combinations of conditions that lead to each file path.

**Subpaths**: The keys in the `exports` field (e.g., `.`, `./utils`, `./package.json`). Wildcards like `./dist/*` are expanded based on actual files in the package.

**Blocking**: When a condition resolves to `null`, it "blocks" that subpath+condition combination from being accessible. The library tracks these blocks and filters them out from results.

**Star expansion**: Wildcard patterns (`*`) in both subpaths and target paths are matched against actual package files and expanded accordingly.

### File Structure

- `src/index.ts` - Main exports: `getPackageEntryPoints` (async) and `getPackageEntryPointsSync`
- `src/analyze-package-exports.ts` - Modern exports field analysis with lazy filesystem access
- `src/resolve-legacy-main.ts` - Legacy fallback for packages without exports field
- `src/create-fs-access.ts` - Filesystem adapter factories for both sync and async variants
- `src/utils/path-matcher.ts` - Wildcard pattern matching for star (`*`) exports
- `src/utils/constants.ts` - Shared constants

### Testing

Tests use [manten](https://github.com/privatenumber/manten) framework with:
- `tests/index.ts` - Test suite entry point
- `tests/utils.ts` - Test helpers including `createPackage` fixture helper and `testScenarios` for async/sync variants
- `tests/specs/` - Feature-based test specs organized by functionality:
  - `pkg-entry-points.ts` - Star patterns, wildcards, fallbacks
  - `exports-types.ts` - Various exports field types (string, array, conditions object)
  - `null-block.ts` - Null condition blocking behavior
  - `merge-conditions.ts` - Condition merging edge cases
  - `no-exports.ts` - Legacy fallback behavior

Each test runs in both `async` and `sync` variants via `testScenarios`.

## Package Configuration

- **Build target**: Node 12.19+ (via pkgroll)
- **Module type**: ESM with CJS compatibility (dual package)
- **Package manager**: pnpm (required)
- **Uses `#pkg-entry-points` import alias**: Maps to `src/index.ts` in development, `dist/index.mjs` in production

## Important Notes

- The library must be built before tests run (tests import from `dist/`)
- Tests create fixtures using `fs-fixture` and validate against actual Node.js resolution
- The `getConditions` function is the core algorithm - it recursively walks the exports structure and builds a map of condition combinations
- When modifying exports parsing logic, ensure both sync and async variants are updated

## Common Bugs & Edge Cases

### Empty String Handling
**Critical**: JavaScript treats empty string `''` as falsy. When working with star pattern matches, always use explicit `!== undefined` checks instead of truthy checks:

```ts
// ❌ Wrong - filters out empty star matches
return starValue && [filePath, starValue];

// ✅ Correct - preserves empty star matches
return starValue !== undefined && [filePath, starValue];
```

**Example**: Pattern `./prefix*.suffix` matching file `./prefix.suffix` produces `starValue = ''` (empty string). This is valid and must be preserved.

### Node.js Validation vs Library Output
Some exports configurations are valid for the library to parse but invalid for Node.js to resolve:
- **Protocol strings** (e.g., `protocol:./file.js`) - Node.js rejects these with `ERR_INVALID_PACKAGE_TARGET`
- **Empty exports object** (`exports: {}`) - Node.js treats as no exports
- **All missing files in fallback array** - Node.js returns `ERR_PACKAGE_PATH_NOT_EXPORTED`

When testing these cases, don't use `assertSubpath()` - just verify library output directly.

### Async/Sync Consistency
Both `getAllFiles` and `getAllFilesSync` must filter out `node_modules` directories. Always maintain feature parity between async and sync variants.

## Testing Tips

```bash
# Run a single test by name
TESTONLY='test name substring' pnpm t

# Run specific test file
TESTONLY='exports-types' pnpm t

# Examples
TESTONLY='empty star match' pnpm t
TESTONLY='async › no exports' pnpm t
```

Each test automatically runs twice (async + sync) via `testScenarios` loop.
