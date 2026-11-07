# @uxuiprinciples/principles-data

Shared data layer for UX/UI Principles: the full research-backed principle taxonomy, smells, and flows.

## Installation

```bash
npm install @uxuiprinciples/principles-data
# or
pnpm add @uxuiprinciples/principles-data
```

## Usage

### Load Principles

```typescript
import {
  loadPrinciples,
  getPrinciple,
  searchPrinciples,
  getPrincipleSummaries
} from '@uxuiprinciples/principles-data';

// Get all principles (metadata only)
const principles = loadPrinciples('en'); // or 'es' for Spanish

// Get a specific principle with full content
const cognitiveLoad = getPrinciple('cognitive-load', 'en');
console.log(cognitiveLoad?.title); // "Cognitive Load Theory"
console.log(cognitiveLoad?.content); // MDX content

// Search principles
const results = searchPrinciples({
  search: 'navigation',
  difficulty: 'beginner',
  part: 'part-1'
});

// Get summaries for listing
const summaries = getPrincipleSummaries('en');
```

### Load Smells (Anti-patterns)

```typescript
import { loadSmells, getSmell, searchSmells } from '@uxuiprinciples/principles-data';

// Get all smells
const smells = loadSmells();

// Get a specific smell
const overloaded = getSmell('overloaded-screen');
console.log(overloaded?.name); // "Overloaded Screen"
console.log(overloaded?.recipe.steps); // Fix steps

// Search smells
const efficiencySmells = searchSmells({ category: 'efficiency' });
```

### Load Flows (User Journey Checklists)

```typescript
import { loadFlows, getFlow, searchFlows } from '@uxuiprinciples/principles-data';

// Get all flows
const flows = loadFlows();

// Get a specific flow
const onboarding = getFlow('onboarding');
console.log(onboarding?.preflight.items); // Pre-design questions
console.log(onboarding?.postflight.items); // Pre-ship checklist

// Search flows
const activationFlows = searchFlows({ metricTarget: 'activation' });
```

### Types

```typescript
import type {
  Principle,
  PrincipleWithContent,
  PrincipleSummary,
  Smell,
  Flow,
  Locale,
  Difficulty
} from '@uxuiprinciples/principles-data';
```

## Data Contents

| Data | Count | Description |
|------|-------|-------------|
| Principles | 195 | Research-backed UX/UI principles |
| Citations | 2,400 | Academic references (floor, rounded down to the hundred) |
| Smells | 12 | Anti-patterns with fix recipes |
| Flows | 12 | User journey checklists |
| Locales | 2 | English and Spanish |

The numbers in this table are kept in step with the source files by `scripts/sync-content-counts.js` in the repository root (`npm run validate:counts`); `PRINCIPLE_COUNT`, `SMELL_COUNT` and `FLOW_COUNT` in `src/index.ts` are derived from the compiled data at build time.

## For Package Development

### Compile Data

After modifying data in the site's `src/data/` or `src/content/`, run:

```bash
npm run compile-data
```

This copies the JSON data and the MDX content into `content/` and `data/` for the build (`npm run build` runs it first).

### Build

```bash
npm run build
```

### Development

```bash
npm run dev  # Watch mode
```

## License

MIT © UX/UI Principles
