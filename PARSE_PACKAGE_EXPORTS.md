# parsePackageExports Design

## Purpose

Provide a web-compatible API for parsing `package.json#exports` without filesystem dependencies. This enables playground/visualization tools to understand the exports structure and generate synthetic file paths for wildcard patterns.

## API

```ts
export const parsePackageExports = (
  exports: PackageJson.Exports
): ParsedExport[]
```

### Type Definition

```ts
type ParsedExport = {
    subpath: string | string[] // string[] when wildcard present
    target: string | string[] // string[] when wildcard present
    conditions: string[] // sorted condition array
}
```

## Behavior

### Static Exports

Input:
```json
{
    ".": {
        "import": "./index.mjs",
        "require": "./index.cjs"
    }
}
```

Output:
```ts
[
    {
        subpath: '.',
        target: './index.mjs',
        conditions: ['import']
    },
    {
        subpath: '.',
        target: './index.cjs',
        conditions: ['require']
    }
]
```

### Wildcard Exports

Input:
```json
{
    "./components/*": "./dist/components/entries/name-*.js"
}
```

Output:
```ts
[
    {
        subpath: ['./components/', ''],
        target: ['./dist/components/entries/name-', '.js'],
        conditions: ['default']
    }
]
```

### Multiple Wildcards in Target

Input:
```json
{
    "./features/*": "./dist/*/index.js"
}
```

Output:
```ts
[
    {
        subpath: ['./features/', ''],
        target: ['./dist/', '/index.js'],
        conditions: ['default']
    }
]
```

### Null Targets (Blocked Exports)

Input:
```json
{
    "./private": null
}
```

Output:
```ts
[] // Filtered out entirely
```

### Fallback Arrays

Input:
```json
{
    ".": [
        "./modern.js",
        "./fallback.js"
    ]
}
```

Output:
```ts
[
    {
        subpath: '.',
        target: './modern.js',
        conditions: ['default']
    },
    {
        subpath: '.',
        target: './fallback.js',
        conditions: ['default']
    }
]
```

## Validation Rules

### Subpath Wildcard Count

**Rule**: Subpath can contain at most 1 wildcard (per Node.js spec)

```json
// ❌ Invalid - throws error
{
    "./*/*": "./dist/index.js"
}
```

**Error message**: `"Subpath pattern can contain at most one wildcard: ./*/*"`

### Target Wildcard Count

**Rule**: Target can contain any number of wildcards (no validation)

```json
// ✅ Valid
{
    "./*": "./dist/*/*/index.js"
}
```

## Implementation Approach

1. **Reuse existing traversal logic** from `getConditions`
   - Recursively walk exports structure
   - Handle strings, arrays, objects, null

2. **Collect all combinations**
   - Track subpath + conditions + target tuples
   - Flatten condition combinations into separate entries

3. **Process wildcards**
   - Split patterns using existing `STAR` constant
   - Validate subpath wildcard count (≤ 1)
   - Return array parts for both subpath and target

4. **Filter null targets**
   - Remove blocked exports from result

5. **Sort conditions**
   - Consistent with existing code (alphabetical)

## Edge Cases

### Empty Exports

```json
{ "exports": {} }
```
Returns: `[]`

### Shorthand String Export

```json
{ "exports": "./index.js" }
```
Returns:
```ts
[{
    subpath: '.',
    target: './index.js',
    conditions: ['default']
}]
```

### Nested Conditions

```json
{
    ".": {
        "node": {
            "import": "./node.mjs",
            "require": "./node.cjs"
        },
        "default": "./index.js"
    }
}
```
Returns:
```ts
[
    {
        subpath: '.',
        target: './index.js',
        conditions: ['default']
    },
    {
        subpath: '.',
        target: './node.mjs',
        conditions: ['import', 'node']
    },
    {
        subpath: '.',
        target: './node.cjs',
        conditions: ['node', 'require']
    }
]
```

## File Structure

- **Location**: `src/parse-package-exports.ts`
- **Exports**: `parsePackageExports` function and `ParsedExport` type
- **Re-export**: Add to `src/index.ts`

## Usage in Playground

```ts
import { parsePackageExports } from 'pkg-entry-points'

const parsed = parsePackageExports(packageJson.exports)

for (const entry of parsed) {
    if (Array.isArray(entry.subpath)) {
    // Dynamic pattern - generate synthetic files
        const syntheticMatches = ['a', 'b', 'c']
        for (const match of syntheticMatches) {
            const subpath = entry.subpath.join(match)
            const target = entry.target.join(match)
            console.log(`${subpath} → ${target} [${entry.conditions.join(', ')}]`)
        }
    } else {
    // Static entry point
        console.log(`${entry.subpath} → ${entry.target} [${entry.conditions.join(', ')}]`)
    }
}
```

## Relationship to Existing Code

- **Does NOT replace** `analyzeExportsWithFiles` - that remains for Node.js use cases with real file validation
- **Could be used internally** by `analyzeExportsWithFiles` to reduce duplication, but not required for v1
- **Shares logic** with `getConditions` but without file system dependency
