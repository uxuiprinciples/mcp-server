/**
 * Principle-related MCP tools
 */

import {
  loadPrinciples,
  getPrinciple,
  searchPrinciples,
  type PrincipleWithContent,
  type PrincipleSummary,
  type Locale
} from '@uxuiprinciples/principles-data';
import { fetchPrinciple, isProMode, PRO_HINT } from '../api-client.js';

/**
 * Normalize a caller-supplied limit to a positive integer. A zero or negative
 * limit would otherwise flow into Array.slice(0, limit) and silently return an
 * empty list while `total` reports the real count. Falls back to `fallback`.
 */
function normalizeLimit(limit: number | undefined, fallback: number): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 1) {
    return fallback;
  }
  return Math.floor(limit);
}

/**
 * Tool: get_principle
 *
 * Free mode: metadata, aiSummary, citations and the link, from the bundled
 * dataset. Pro mode (UXUI_API_KEY set): the same plus the full guide body
 * fetched from /api/v1/principles. An API failure degrades to the free
 * answer with `proError` filled in, never to an error.
 */
export async function getPrincipleTool(slug: string, locale: Locale = 'en'): Promise<{
  success: boolean;
  tier: 'free' | 'pro';
  principle?: PrincipleWithContent;
  proError?: { code: string; message: string };
  error?: string;
}> {
  try {
    const principle = getPrinciple(slug, locale);

    if (!principle) {
      return {
        success: false,
        tier: isProMode() ? 'pro' : 'free',
        error: `Principle not found: ${slug}. Use search_principles to find valid slugs.`
      };
    }

    if (!isProMode()) {
      return { success: true, tier: 'free', principle };
    }

    const remote = await fetchPrinciple(slug, locale);
    if (!remote.ok) {
      return {
        success: true,
        tier: 'pro',
        principle,
        proError: { code: remote.code, message: remote.message },
      };
    }

    const body = typeof remote.data.content === 'string' ? remote.data.content : '';
    return {
      success: true,
      tier: 'pro',
      principle: {
        ...principle,
        // The full guide replaces the summary-plus-link stub; the link stays
        // in frontmatter.url for citing.
        content: body || principle.content,
      },
    };
  } catch (error) {
    return {
      success: false,
      tier: isProMode() ? 'pro' : 'free',
      error: `Error fetching principle: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Tool: search_principles
 * Search principles by query, part, difficulty, or tags
 */
export function searchPrinciplesTool(
  query?: string,
  part?: string,
  difficulty?: 'beginner' | 'intermediate' | 'advanced',
  tags?: string[],
  locale: Locale = 'en',
  limit: number = 10
): {
  success: boolean;
  results?: PrincipleSummary[];
  total?: number;
  error?: string;
} {
  try {
    const principles = searchPrinciples(
      { search: query, part, difficulty, tags },
      locale
    );

    const summaries = principles.slice(0, normalizeLimit(limit, 10)).map(p => ({
      slug: p.slug,
      title: p.title,
      code: p.code,
      partName: p.partName,
      aiSummary: p.aiSummary
    }));

    return {
      success: true,
      results: summaries,
      total: principles.length
    };
  } catch (error) {
    return {
      success: false,
      error: `Error searching principles: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Tool: list_principles
 * List all principles or filter by part
 */
export function listPrinciplesTool(
  part?: string,
  locale: Locale = 'en',
  limit: number = 20
): {
  success: boolean;
  principles?: PrincipleSummary[];
  total?: number;
  parts?: string[];
  error?: string;
} {
  try {
    const allPrinciples = loadPrinciples(locale);

    // Get unique parts
    const parts = [...new Set(allPrinciples.map(p => p.part))].sort();

    // Filter by part if specified
    let filtered = part
      ? allPrinciples.filter(p => p.part === part || p.partName.toLowerCase().includes(part.toLowerCase()))
      : allPrinciples;

    const summaries = filtered.slice(0, normalizeLimit(limit, 20)).map(p => ({
      slug: p.slug,
      title: p.title,
      code: p.code,
      partName: p.partName,
      aiSummary: p.aiSummary
    }));

    return {
      success: true,
      principles: summaries,
      total: filtered.length,
      parts
    };
  } catch (error) {
    return {
      success: false,
      error: `Error listing principles: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Tool: get_principle_prompts
 *
 * Pro mode: the principle's AI prompts, read from the guide frontmatter
 * through /api/v1/principles. Free mode: the link to the guide, since the
 * 600+ prompts belong to the paid Principles Library and are not bundled.
 */
export async function getPrinciplePromptsTool(
  slug: string,
  locale: Locale = 'en'
): Promise<{
  success: boolean;
  tier: 'free' | 'pro';
  principle?: { slug: string; title: string; url: string };
  prompts?: string[];
  note?: string;
  proError?: { code: string; message: string };
  error?: string;
}> {
  try {
    const principle = getPrinciple(slug, locale);

    if (!principle) {
      return {
        success: false,
        tier: isProMode() ? 'pro' : 'free',
        error: `Principle not found: ${slug}`
      };
    }

    const frontmatter = principle.frontmatter as Record<string, unknown>;
    const url = (frontmatter.url as string) || `https://uxuiprinciples.com/${locale}/principles/${principle.slug}`;
    const ref = { slug: principle.slug, title: principle.title, url };

    if (!isProMode()) {
      return {
        success: true,
        tier: 'free',
        principle: ref,
        prompts: [],
        note: `The AI prompts for this principle are part of the Principles Library: ${url}. ${PRO_HINT}`
      };
    }

    const remote = await fetchPrinciple(slug, locale);
    if (!remote.ok) {
      return {
        success: true,
        tier: 'pro',
        principle: ref,
        prompts: [],
        note: `Prompts unavailable right now; the guide is at ${url}`,
        proError: { code: remote.code, message: remote.message },
      };
    }

    const raw = remote.data.frontmatter?.vibeCodingPrompts;
    const prompts = Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string' && p.trim() !== '') : [];

    return {
      success: true,
      tier: 'pro',
      principle: ref,
      prompts,
      ...(prompts.length === 0 ? { note: `This principle has no prompts in its guide yet: ${url}` } : {}),
    };
  } catch (error) {
    return {
      success: false,
      tier: isProMode() ? 'pro' : 'free',
      error: `Error fetching prompts: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
