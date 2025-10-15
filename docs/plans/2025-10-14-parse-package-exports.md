# parsePackageExports Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add web-compatible API for parsing `package.json#exports` without filesystem dependencies, enabling playground/visualization tools to understand exports structure.

**Architecture:** New `parsePackageExports` function traverses exports structure similar to existing `getConditions`, but returns flat array of `ParsedExport` entries with wildcards split into string arrays. No file validation required.

**Tech Stack:** TypeScript, manten (testing), fs-fixture (test fixtures)

---

## Task 1: Add ParsedExport Type

**Files:**
- Modify: `src/types.ts`
- Test: Not applicable (type-only change)

**Step 1: Add ParsedExport type definition**

Add to `src/types.ts` after existing types:

```ts
export type ParsedExport = {
    subpath: string | string[]
    target: string | string[]
    conditions: string[]
}
```

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add ParsedExport type for web-compatible parsing"
```

---

## Task 2: Create Test File and First Test (Static String Export)

**Files:**
- Create: `tests/specs/parse-package-exports.ts`

**Step 1: Write failing test for basic static export**

Create `tests/specs/parse-package-exports.ts`:

```ts
import { testSuite, expect } from 'manten'
import { parsePackageExports } from '#pkg-entry-points'

export default testSuite(({ describe }) => {
    describe('parsePackageExports', ({ test }) => {
        test('string export', () => {
            const result = parsePackageExports('./index.js')

            expect(result).toStrictEqual([
                {
                    subpath: '.',
                    target: './index.js',
                    conditions: ['default']
                }
            ])
        })
    })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm build && pnpm test`

Expected: FAIL with "parsePackageExports is not exported"

**Step 3: Create minimal implementation file**

Create `src/parse-package-exports.ts`:

```ts
import type { PackageJson } from 'type-fest'
import type { ParsedExport } from './types.js'

export const parsePackageExports = (
    exports: PackageJson.Exports
): ParsedExport[] => {
    if (typeof exports === 'string') {
        return [
            {
                subpath: '.',
                target: exports,
                conditions: ['default']
            }
        ]
    }

    return []
}
```

**Step 4: Export from index.ts**

Add to `src/index.ts`:

```ts
export { parsePackageExports } from './parse-package-exports.js'
export type { ParsedExport } from './types.js'
```

**Step 5: Run test to verify it passes**

Run: `pnpm build && pnpm test`

Expected: PASS

**Step 6: Commit**

```bash
git add tests/specs/parse-package-exports.ts src/parse-package-exports.ts src/index.ts
git commit -m "feat: add parsePackageExports with string export support"
```

---

## Task 3: Handle Null Exports

**Files:**
- Modify: `tests/specs/parse-package-exports.ts`
- Modify: `src/parse-package-exports.ts`

**Step 1: Write failing test**

Add to `tests/specs/parse-package-exports.ts`:

```ts
test('null export (should filter out)', () => {
    const result = parsePackageExports(null)

    expect(result).toStrictEqual([])
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm build && pnpm test`

Expected: FAIL (null case not handled)

**Step 3: Implement null handling**

Update `src/parse-package-exports.ts`:

```ts
export const parsePackageExports = (
    exports: PackageJson.Exports
): ParsedExport[] => {
    if (exports === null) {
        return []
    }

    if (typeof exports === 'string') {
        return [
            {
                subpath: '.',
                target: exports,
                conditions: ['default']
            }
        ]
    }

    return []
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm build && pnpm test`

Expected: PASS

**Step 5: Commit**

```bash
git add tests/specs/parse-package-exports.ts src/parse-package-exports.ts
git commit -m "feat: filter out null exports in parsePackageExports"
```

---

## Task 4: Handle Empty Object

**Files:**
- Modify: `tests/specs/parse-package-exports.ts`
- Modify: `src/parse-package-exports.ts`

**Step 1: Write failing test**

Add to `tests/specs/parse-package-exports.ts`:

```ts
test('empty object', () => {
    const result = parsePackageExports({})

    expect(result).toStrictEqual([])
})
```

**Step 2: Run test to verify it passes**

Run: `pnpm build && pnpm test`

Expected: PASS (already returns empty array for objects)

**Step 3: Commit**

```bash
git add tests/specs/parse-package-exports.ts
git commit -m "test: add empty object test for parsePackageExports"
```

---

## Task 5: Handle Simple Condition Object

**Files:**
- Modify: `tests/specs/parse-package-exports.ts`
- Modify: `src/parse-package-exports.ts`

**Step 1: Write failing test**

Add to `tests/specs/parse-package-exports.ts`:

```ts
test('conditions object', () => {
    const result = parsePackageExports({
        import: './index.mjs',
        require: './index.cjs'
    })

    expect(result).toStrictEqual([
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
    ])
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm build && pnpm test`

Expected: FAIL (returns empty array)

**Step 3: Implement recursive traversal**

Update `src/parse-package-exports.ts`:

```ts
import type { PackageJson } from 'type-fest'
import type { ParsedExport } from './types.js'

type ParseContext = {
    subpath: string
    conditionsPath: string[]
}

const traverseExports = (
    exports: PackageJson.Exports,
    context: ParseContext,
    results: ParsedExport[]
): void => {
    if (exports === null) {
        return
    }

    if (typeof exports === 'string') {
        results.push({
            subpath: context.subpath,
            target: exports,
            conditions: context.conditionsPath.length > 0
                ? context.conditionsPath
                : ['default']
        })
        return
    }

    if (typeof exports === 'object' && exports) {
        const keys = Object.keys(exports)

        if (keys.length === 0) {
            return
        }

        const isPathsObject = keys[0][0] === '.'

        if (isPathsObject) {
            // Multiple subpaths
            for (const subpath of keys) {
                if (!Object.hasOwn(exports, subpath)) {
                    continue
                }

                traverseExports(
                    (exports as PackageJson.ExportConditions)[subpath]!,
                    {
                        subpath,
                        conditionsPath: []
                    },
                    results
                )
            }
        } else {
            // Conditions object
            for (const condition of keys) {
                if (!Object.hasOwn(exports, condition)) {
                    continue
                }

                const newConditionsPath = [...context.conditionsPath, condition].sort()

                traverseExports(
                    (exports as PackageJson.ExportConditions)[condition]!,
                    {
                        ...context,
                        conditionsPath: newConditionsPath
                    },
                    results
                )
            }
        }
    }
}

export const parsePackageExports = (
    exports: PackageJson.Exports
): ParsedExport[] => {
    const results: ParsedExport[] = []

    traverseExports(exports, {
        subpath: '.',
        conditionsPath: []
    }, results)

    return results
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm build && pnpm test`

Expected: PASS

**Step 5: Commit**

```bash
git add tests/specs/parse-package-exports.ts src/parse-package-exports.ts
git commit -m "feat: add recursive traversal for conditions in parsePackageExports"
```

---

## Task 6: Handle Nested Conditions

**Files:**
- Modify: `tests/specs/parse-package-exports.ts`

**Step 1: Write test for nested conditions**

Add to `tests/specs/parse-package-exports.ts`:

```ts
test('nested conditions', () => {
    const result = parsePackageExports({
        node: {
            import: './node.mjs',
            require: './node.cjs'
        },
        default: './index.js'
    })

    expect(result).toStrictEqual([
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
    ])
})
```

**Step 2: Run test to verify it passes**

Run: `pnpm build && pnpm test`

Expected: PASS (already works with recursive implementation)

**Step 3: Commit**

```bash
git add tests/specs/parse-package-exports.ts
git commit -m "test: add nested conditions test for parsePackageExports"
```

---

## Task 7: Handle Multiple Subpaths

**Files:**
- Modify: `tests/specs/parse-package-exports.ts`

**Step 1: Write test for multiple subpaths**

Add to `tests/specs/parse-package-exports.ts`:

```ts
test('multiple subpaths', () => {
    const result = parsePackageExports({
        '.': './index.js',
        './utils': './utils.js',
        './package.json': './package.json'
    })

    expect(result).toStrictEqual([
        {
            subpath: '.',
            target: './index.js',
            conditions: ['default']
        },
        {
            subpath: './utils',
            target: './utils.js',
            conditions: ['default']
        },
        {
            subpath: './package.json',
            target: './package.json',
            conditions: ['default']
        }
    ])
})
```

**Step 2: Run test to verify it passes**

Run: `pnpm build && pnpm test`

Expected: PASS (already works)

**Step 3: Commit**

```bash
git add tests/specs/parse-package-exports.ts
git commit -m "test: add multiple subpaths test for parsePackageExports"
```

---

## Task 8: Handle Wildcard Subpath (Single Wildcard)

**Files:**
- Modify: `tests/specs/parse-package-exports.ts`
- Modify: `src/parse-package-exports.ts`

**Step 1: Write failing test**

Add to `tests/specs/parse-package-exports.ts`:

```ts
test('wildcard subpath', () => {
    const result = parsePackageExports({
        './components/*': './dist/components/*.js'
    })

    expect(result).toStrictEqual([
        {
            subpath: ['./components/', ''],
            target: ['./dist/components/', '.js'],
            conditions: ['default']
        }
    ])
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm build && pnpm test`

Expected: FAIL (wildcards not split)

**Step 3: Import STAR constant and split wildcards**

Update `src/parse-package-exports.ts`:

```ts
import type { PackageJson } from 'type-fest'
import type { ParsedExport } from './types.js'
import { STAR } from './utils/constants.js'

type ParseContext = {
    subpath: string
    conditionsPath: string[]
}

const traverseExports = (
    exports: PackageJson.Exports,
    context: ParseContext,
    results: ParsedExport[]
): void => {
    if (exports === null) {
        return
    }

    if (typeof exports === 'string') {
        const subpathHasStar = context.subpath.includes(STAR)
        const targetHasStar = exports.includes(STAR)

        results.push({
            subpath: subpathHasStar ? context.subpath.split(STAR) : context.subpath,
            target: targetHasStar ? exports.split(STAR) : exports,
            conditions: context.conditionsPath.length > 0
                ? context.conditionsPath
                : ['default']
        })
        return
    }

    if (typeof exports === 'object' && exports) {
        const keys = Object.keys(exports)

        if (keys.length === 0) {
            return
        }

        const isPathsObject = keys[0][0] === '.'

        if (isPathsObject) {
            // Multiple subpaths
            for (const subpath of keys) {
                if (!Object.hasOwn(exports, subpath)) {
                    continue
                }

                traverseExports(
                    (exports as PackageJson.ExportConditions)[subpath]!,
                    {
                        subpath,
                        conditionsPath: []
                    },
                    results
                )
            }
        } else {
            // Conditions object
            for (const condition of keys) {
                if (!Object.hasOwn(exports, condition)) {
                    continue
                }

                const newConditionsPath = [...context.conditionsPath, condition].sort()

                traverseExports(
                    (exports as PackageJson.ExportConditions)[condition]!,
                    {
                        ...context,
                        conditionsPath: newConditionsPath
                    },
                    results
                )
            }
        }
    }
}

export const parsePackageExports = (
    exports: PackageJson.Exports
): ParsedExport[] => {
    const results: ParsedExport[] = []

    traverseExports(exports, {
        subpath: '.',
        conditionsPath: []
    }, results)

    return results
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm build && pnpm test`

Expected: PASS

**Step 5: Commit**

```bash
git add tests/specs/parse-package-exports.ts src/parse-package-exports.ts
git commit -m "feat: split wildcard patterns in parsePackageExports"
```

---

## Task 9: Handle Multiple Wildcards in Target

**Files:**
- Modify: `tests/specs/parse-package-exports.ts`

**Step 1: Write test for multiple wildcards**

Add to `tests/specs/parse-package-exports.ts`:

```ts
test('multiple wildcards in target', () => {
    const result = parsePackageExports({
        './features/*': './dist/*/*/index.js'
    })

    expect(result).toStrictEqual([
        {
            subpath: ['./features/', ''],
            target: ['./dist/', '/', '/index.js'],
            conditions: ['default']
        }
    ])
})
```

**Step 2: Run test to verify it passes**

Run: `pnpm build && pnpm test`

Expected: PASS (split already handles multiple wildcards)

**Step 3: Commit**

```bash
git add tests/specs/parse-package-exports.ts
git commit -m "test: add multiple wildcards test for parsePackageExports"
```

---

## Task 10: Validate Subpath Wildcard Count

**Files:**
- Modify: `tests/specs/parse-package-exports.ts`
- Modify: `src/parse-package-exports.ts`

**Step 1: Write failing test**

Add to `tests/specs/parse-package-exports.ts`:

```ts
test('throws on multiple wildcards in subpath', () => {
    expect(() => {
        parsePackageExports({
            './*/*': './dist/index.js'
        })
    }).toThrow('Subpath pattern can contain at most one wildcard: ./*/*')
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm build && pnpm test`

Expected: FAIL (no validation)

**Step 3: Add validation**

Update `src/parse-package-exports.ts`:

```ts
const traverseExports = (
    exports: PackageJson.Exports,
    context: ParseContext,
    results: ParsedExport[]
): void => {
    if (exports === null) {
        return
    }

    if (typeof exports === 'string') {
        const subpathHasStar = context.subpath.includes(STAR)
        const targetHasStar = exports.includes(STAR)

        // Validate subpath wildcard count
        if (subpathHasStar) {
            const subpathParts = context.subpath.split(STAR)
            if (subpathParts.length > 2) {
                throw new Error(`Subpath pattern can contain at most one wildcard: ${context.subpath}`)
            }
        }

        results.push({
            subpath: subpathHasStar ? context.subpath.split(STAR) : context.subpath,
            target: targetHasStar ? exports.split(STAR) : exports,
            conditions: context.conditionsPath.length > 0
                ? context.conditionsPath
                : ['default']
        })
    }

    // ... rest of function unchanged
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm build && pnpm test`

Expected: PASS

**Step 5: Commit**

```bash
git add tests/specs/parse-package-exports.ts src/parse-package-exports.ts
git commit -m "feat: validate subpath wildcard count in parsePackageExports"
```

---

## Task 11: Handle Fallback Arrays

**Files:**
- Modify: `tests/specs/parse-package-exports.ts`
- Modify: `src/parse-package-exports.ts`

**Step 1: Write failing test**

Add to `tests/specs/parse-package-exports.ts`:

```ts
test('fallback array', () => {
    const result = parsePackageExports({
        '.': ['./modern.js', './fallback.js']
    })

    expect(result).toStrictEqual([
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
    ])
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm build && pnpm test`

Expected: FAIL (arrays not handled)

**Step 3: Handle array exports**

Update `src/parse-package-exports.ts`:

```ts
const traverseExports = (
    exports: PackageJson.Exports,
    context: ParseContext,
    results: ParsedExport[]
): void => {
    if (exports === null) {
        return
    }

    if (typeof exports === 'string') {
        const subpathHasStar = context.subpath.includes(STAR)
        const targetHasStar = exports.includes(STAR)

        // Validate subpath wildcard count
        if (subpathHasStar) {
            const subpathParts = context.subpath.split(STAR)
            if (subpathParts.length > 2) {
                throw new Error(`Subpath pattern can contain at most one wildcard: ${context.subpath}`)
            }
        }

        results.push({
            subpath: subpathHasStar ? context.subpath.split(STAR) : context.subpath,
            target: targetHasStar ? exports.split(STAR) : exports,
            conditions: context.conditionsPath.length > 0
                ? context.conditionsPath
                : ['default']
        })
        return
    }

    if (Array.isArray(exports)) {
        for (const entry of exports) {
            traverseExports(entry, context, results)
        }
        return
    }

    if (typeof exports === 'object' && exports) {
        // ... rest unchanged
    }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm build && pnpm test`

Expected: PASS

**Step 5: Commit**

```bash
git add tests/specs/parse-package-exports.ts src/parse-package-exports.ts
git commit -m "feat: support fallback arrays in parsePackageExports"
```

---

## Task 12: Handle Null Targets in Nested Objects

**Files:**
- Modify: `tests/specs/parse-package-exports.ts`

**Step 1: Write test for null in conditions**

Add to `tests/specs/parse-package-exports.ts`:

```ts
test('null in conditions object (filtered out)', () => {
    const result = parsePackageExports({
        '.': {
            import: './index.mjs',
            require: null
        }
    })

    expect(result).toStrictEqual([
        {
            subpath: '.',
            target: './index.mjs',
            conditions: ['import']
        }
    ])
})
```

**Step 2: Run test to verify it passes**

Run: `pnpm build && pnpm test`

Expected: PASS (null handling already filters them out)

**Step 3: Commit**

```bash
git add tests/specs/parse-package-exports.ts
git commit -m "test: add null in conditions test for parsePackageExports"
```

---

## Task 13: Complex Integration Test

**Files:**
- Modify: `tests/specs/parse-package-exports.ts`

**Step 1: Write comprehensive integration test**

Add to `tests/specs/parse-package-exports.ts`:

```ts
test('complex exports with multiple features', () => {
    const result = parsePackageExports({
        '.': {
            import: './index.mjs',
            require: './index.cjs'
        },
        './utils': './utils.js',
        './features/*': {
            node: './dist/node/*/index.js',
            default: './dist/browser/*/index.js'
        },
        './private': null
    })

    expect(result).toStrictEqual([
        {
            subpath: '.',
            target: './index.mjs',
            conditions: ['import']
        },
        {
            subpath: '.',
            target: './index.cjs',
            conditions: ['require']
        },
        {
            subpath: './utils',
            target: './utils.js',
            conditions: ['default']
        },
        {
            subpath: ['./features/', ''],
            target: ['./dist/node/', '/index.js'],
            conditions: ['node']
        },
        {
            subpath: ['./features/', ''],
            target: ['./dist/browser/', '/index.js'],
            conditions: ['default']
        }
    ])
})
```

**Step 2: Run test to verify it passes**

Run: `pnpm build && pnpm test`

Expected: PASS

**Step 3: Commit**

```bash
git add tests/specs/parse-package-exports.ts
git commit -m "test: add comprehensive integration test for parsePackageExports"
```

---

## Task 14: Add Tests to Main Test Suite

**Files:**
- Modify: `tests/index.ts`

**Step 1: Import new test suite**

Add to `tests/index.ts`:

```ts
import parsePackageExports from './specs/parse-package-exports.js'
```

And add to the test suite list:

```ts
testSuite.concurrent([
    // ... existing imports
    parsePackageExports
])
```

**Step 2: Run all tests to verify**

Run: `pnpm build && pnpm test`

Expected: All tests PASS

**Step 3: Commit**

```bash
git add tests/index.ts
git commit -m "test: integrate parsePackageExports tests into main suite"
```

---

## Task 15: Verify Exports and Type Definitions

**Files:**
- Verify: `src/index.ts`
- Verify: `package.json`

**Step 1: Verify exports in index.ts**

Check that `src/index.ts` includes:

```ts
export { parsePackageExports } from './parse-package-exports.js'
export type { ParsedExport } from './types.js'
```

**Step 2: Build and verify type exports**

Run: `pnpm build`

Expected: Build succeeds, `dist/` contains type definitions

**Step 3: Manual verification**

In a test file, verify imports work:

```ts
import { parsePackageExports, type ParsedExport } from 'pkg-entry-points'
```

**Step 4: Run final full test suite**

Run: `pnpm build && pnpm test`

Expected: All tests PASS

**Step 5: Commit if any fixes needed**

```bash
git add .
git commit -m "fix: ensure proper exports of parsePackageExports API"
```

---

## Completion Checklist

- [ ] All tests passing
- [ ] Build succeeds without errors
- [ ] Type definitions exported correctly
- [ ] Code follows project conventions (see CLAUDE.md)
- [ ] No linting errors (`pnpm lint`)
- [ ] Git history is clean with descriptive commits
- [ ] PARSE_PACKAGE_EXPORTS.md design doc still accurate (update if needed)

## Related Skills

- `${SUPERPOWERS_SKILLS_ROOT}/skills/testing/test-driven-development/SKILL.md` - Follow TDD cycle for each task
- `${SUPERPOWERS_SKILLS_ROOT}/skills/debugging/verification-before-completion/SKILL.md` - Verify work before claiming complete
