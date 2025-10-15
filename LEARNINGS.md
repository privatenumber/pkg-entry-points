# Learnings: Lazy Filesystem Refactor

## Context

**Goal**: Refactor package entry point resolution from eager (scan all files upfront) to lazy (only check files referenced in exports).

**Motivation**: Minimize filesystem interactions by only checking files that are actually referenced.

## What We Did

1. Created filesystem abstraction layer (`FileSystemAccess` / `AsyncFileSystemAccess`)
2. Split exports analysis into two phases:
   - Phase 1: Pure tree-walking (collect export attempts)
   - Phase 2: Filesystem resolution (check if files exist)
3. Moved from `stat().isFile()` to `fs.access()` for existence checks
4. Used `readdir({ withFileTypes: true })` to eliminate separate `stat()` calls
5. Refactored legacy resolution to use same filesystem abstraction

## The Problem

**Legacy packages (without `exports` field) still scan all files.**

```typescript
// In resolveLegacyMain.ts
const packageFiles = fs.readdirAll('.') // ← Still eager!
```

For packages without `exports`, the behavior is: **"every JS file in the package is an entry point"**. This inherently requires enumerating all files.

## Why This Matters

- **Modern packages** (with `exports`): ✅ Benefit from lazy filesystem access
- **Legacy packages** (without `exports`): ❌ Still require full directory scan
- **Reality**: Many popular packages still don't use `exports` field

The optimization only helps packages that have adopted modern `exports` - a smaller subset than initially assumed.

## What We Learned

### 1. Analyze the entire code flow before optimizing

We focused on the modern exports path without fully considering legacy packages. Should have traced both code paths from the beginning.

**Red flag we missed**: The tests had "no exports" test cases that list all files. These should have been a signal.

### 2. Understand the contract before changing implementation

The legacy package contract is: "return all JS files as entry points". This inherently requires scanning the directory tree. Can't make it lazy without breaking the contract.

**Options we have**:
- Break the API (only return `main` for legacy packages)
- Keep eager scanning for legacy packages
- Make it configurable

### 3. Partial optimization is still valuable (but be honest about it)

The refactor **does** help modern packages with `exports` field. But we should have been explicit about:
- What percentage of packages benefit?
- What's the fallback behavior?
- Is the complexity worth it?

### 4. Code organization improvements have value beyond performance

Even if the lazy optimization doesn't apply everywhere:
- Clearer separation of concerns (filesystem abstraction)
- Two-phase architecture (tree walking vs resolution)
- Eliminated code duplication between sync/async

These are wins independent of the performance goal.

### 5. Check assumptions early with representative tests

Should have asked: "What happens with a package that has no exports?" earlier in the process. Running the full test suite earlier would have revealed this.

## What We'd Do Differently

1. **Profile first**: Measure how many packages in the wild use `exports` vs legacy
2. **Document tradeoffs upfront**: "This optimization only helps packages with exports field"
3. **Consider hybrid approach**: Lazy for modern, document that legacy is eager
4. **Ask: Is the complexity worth it?**: If only 30% of packages benefit, maybe the abstraction overhead isn't justified

## Current State

**Stats**: +688 -295 lines (net +393)

**What works**:
- ✅ Modern packages with `exports`: Lazy filesystem access
- ✅ Better code organization
- ✅ Single syscall per directory with `withFileTypes: true`
- ✅ Eliminated `stat()` calls for checking directories vs files

**What doesn't**:
- ❌ Legacy packages: Still scan entire directory tree
- ❌ Added complexity may not be worth it if legacy packages are common

## Decision Point

**Do we**:
1. **Accept partial win**: Document that optimization only applies to modern packages
2. **Revert refactor**: If legacy packages are majority, added complexity isn't justified
3. **Break the API**: Only return `main` for legacy packages (lazy but breaking change)

## Key Takeaway

**Always trace the full code path before architectural changes.** We optimized one path (modern exports) without realizing the other path (legacy) still requires eager loading. The contract for legacy packages ("all files are entry points") fundamentally conflicts with lazy loading.
