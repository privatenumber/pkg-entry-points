# Playground Development Plan

Interactive playground for visualizing package.json exports resolution.

## Goals

- Help developers understand how package.json exports work
- Visualize dangerous wildcard patterns that expose unintended files
- Educational tool for learning Node.js exports field
- No backend needed - runs entirely in browser

## Tech Stack

- **Vite** - Fast dev server and build tool
- **Tailwind CSS** - Styling
- **modern-monaco** - Monaco editor component
- **pkg-entry-points** - Core library (symbolic mode)

## Architecture

### Phase 1: Core API ✅

**Status: Complete**

- Added `analyzeExports(exports, packageFiles?)` function
- Symbolic mode: Works without filesystem
- 10 new tests covering symbolic mode
- Documentation updated

### Phase 2: Playground UI (Future PR)

**Layout:**
```
┌─────────────────────────────────────────┐
│           pkg-entry-points              │
│                                         │
├──────────────────┬──────────────────────┤
│                  │                      │
│  Monaco Editor   │   Output Panel       │
│                  │                      │
│  package.json    │  • Entry Points      │
│  exports field   │  • Conditions        │
│                  │  • Warnings          │
│                  │                      │
└──────────────────┴──────────────────────┘
```

**Left Panel (Input):**
- Monaco editor with JSON validation
- Edit exports field directly
- Syntax highlighting
- Error detection

**Right Panel (Output):**
- Parsed entry points from `analyzeExports()`
- Visual condition tree
- Warning badges for wildcards
- "Dangerous files" section showing potential leaks

**Dangerous Wildcard Detection:**
When pattern contains `*`, split on wildcard and generate example files:
```ts
// Pattern: './dist/*.js'
// Split: ['./dist/', '.js']
// Generate warnings:
const dangerousExamples = [
  './dist/_private-file.js',
  './dist/secret-config.js',
  './dist/.env.js',
  './dist/internal-helper.js',
]
```

**Features:**
- Real-time updates as you type
- Example templates (dropdown)
- Copy output as JSON
- Share via URL (encode exports in query param)
- Dark/light theme toggle

**Example Templates:**
- Basic entry point
- Multiple conditions (import/require)
- Wildcard patterns
- Nested conditions
- Dangerous wildcard (demonstration)

## Implementation Steps

1. Set up Vite project in `/playground`
2. Install dependencies (tailwind, modern-monaco)
3. Create layout components
4. Integrate Monaco editor
5. Wire up `analyzeExports()` from pkg-entry-points
6. Implement wildcard warning system
7. Add example templates
8. Deploy to Vercel/Netlify

## Non-Goals

- No package validation against real npm registry
- No filesystem simulation (use symbolic mode only)
- No Node.js resolution algorithm implementation
- No backend API

## Future Enhancements

- Export analysis as markdown report
- GitHub integration (analyze any package)
- Visual graph view of conditions
- Performance metrics (entry point count)
