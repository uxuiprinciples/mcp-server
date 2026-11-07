/**
 * Data loaders for principles, smells, and flows.
 *
 * All data is compiled into src/generated/dataset.ts at build time (see
 * scripts/compile-data.mjs) and inlined into the bundle by tsup, so these
 * loaders do zero filesystem or network access at runtime. This is what lets
 * the published package work from a fresh install with an arbitrary cwd.
 *
 * CONTENT PROTECTION: the dataset holds only public principle metadata +
 * aiSummary. Full body-frozen guides and paywalled frontmatter are NOT bundled;
 * getPrinciple returns the summary plus a link to the full guide on the site.
 */

import type {
  Principle,
  PrincipleWithContent,
  PrincipleSummary,
  PrincipleFilter,
  Smell,
  SmellFilter,
  Flow,
  FlowFilter,
  Locale,
} from './types';
import { smells as SMELLS, flows as FLOWS, principles as PRINCIPLES } from './generated/dataset';

const SITE_URL = 'https://uxuiprinciples.com';

// =============================================================================
// SMELLS
// =============================================================================

export function loadSmells(): Smell[] {
  return SMELLS;
}

export function getSmell(id: string): Smell | undefined {
  return SMELLS.find((s) => s.id === id);
}

export function searchSmells(filter?: SmellFilter): Smell[] {
  let smells = SMELLS;

  if (filter?.category) {
    smells = smells.filter((s) => s.category === filter.category);
  }

  if (filter?.nielsenHeuristic) {
    smells = smells.filter((s) => s.nielsenHeuristic === filter.nielsenHeuristic);
  }

  if (filter?.relatedPrinciple) {
    smells = smells.filter((s) => s.relatedPrinciples.includes(filter.relatedPrinciple!));
  }

  return smells;
}

// =============================================================================
// FLOWS
// =============================================================================

export function loadFlows(): Flow[] {
  return FLOWS;
}

export function getFlow(id: string): Flow | undefined {
  return FLOWS.find((f) => f.id === id);
}

export function searchFlows(filter?: FlowFilter): Flow[] {
  let flows = FLOWS;

  if (filter?.metricTarget) {
    flows = flows.filter((f) => f.metricTarget === filter.metricTarget);
  }

  if (filter?.commonSmell) {
    flows = flows.filter((f) => f.commonSmells.includes(filter.commonSmell!));
  }

  return flows;
}

// =============================================================================
// PRINCIPLES
// =============================================================================

export function loadPrinciples(locale: Locale = 'en'): Principle[] {
  return PRINCIPLES[locale] ?? PRINCIPLES.en;
}

/**
 * Get a principle by slug. Returns public metadata + aiSummary and a link to the
 * full guide. The full body content is paywalled (Principles Library) and is
 * intentionally not bundled, so `content` carries the summary plus that link.
 */
export function getPrinciple(slug: string, locale: Locale = 'en'): PrincipleWithContent | undefined {
  const principle = loadPrinciples(locale).find((p) => p.slug === slug);
  if (!principle) return undefined;

  const url = `${SITE_URL}/${locale}/principles/${principle.slug}`;
  const summary = principle.aiSummary ? `${principle.aiSummary}\n\n` : '';
  const content =
    `${summary}Read the full research-backed principle, examples, and implementation guidance at ${url}`;

  return {
    ...principle,
    content,
    frontmatter: {
      slug: principle.slug,
      title: principle.title,
      code: principle.code,
      aiSummary: principle.aiSummary,
      tags: principle.tags,
      url,
    },
  };
}

export function searchPrinciples(filter?: PrincipleFilter, locale: Locale = 'en'): Principle[] {
  let principles = loadPrinciples(locale);

  if (filter?.part) {
    // Match by part id (e.g. "part-2") or by part name substring (e.g.
    // "Foundations", "Core Principles"), mirroring listPrinciples so both tools
    // accept the values advertised in the MCP schema.
    const partLower = filter.part.toLowerCase();
    principles = principles.filter(
      (p) => p.part === filter.part || p.partName.toLowerCase().includes(partLower)
    );
  }

  if (filter?.difficulty) {
    principles = principles.filter((p) => p.difficulty === filter.difficulty);
  }

  if (filter?.tags && filter.tags.length > 0) {
    principles = principles.filter((p) => p.tags?.some((tag) => filter.tags!.includes(tag)));
  }

  if (filter?.search) {
    const searchLower = filter.search.toLowerCase();
    principles = principles.filter(
      (p) =>
        p.title.toLowerCase().includes(searchLower) ||
        p.slug.toLowerCase().includes(searchLower) ||
        p.aiSummary?.toLowerCase().includes(searchLower) ||
        p.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
    );
  }

  return principles;
}

export function getPrincipleSummaries(locale: Locale = 'en'): PrincipleSummary[] {
  return loadPrinciples(locale).map((p) => ({
    slug: p.slug,
    title: p.title,
    code: p.code,
    partName: p.partName,
    aiSummary: p.aiSummary,
  }));
}

/**
 * No-op retained for API compatibility. Data is static and compiled at build
 * time, so there are no runtime caches to clear.
 */
export function clearCache(): void {
  /* intentionally empty */
}
