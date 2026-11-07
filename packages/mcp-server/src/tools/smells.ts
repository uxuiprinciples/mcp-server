/**
 * Smell-related MCP tools (UX Anti-patterns)
 */

import {
  loadSmells,
  getSmell,
  type Locale
} from '@uxuiprinciples/principles-data';
import { SMELL_KEYWORDS } from './smell-keywords.js';

/**
 * Tool: get_smell
 * Get a UX smell (anti-pattern) by ID with fix recipe
 */
export function getSmellTool(id: string, locale: Locale = 'en'): {
  success: boolean;
  smell?: {
    id: string;
    name: string;
    tagline: string;
    symptoms: string[];
    nielsenHeuristic: number;
    nielsenName: string;
    recipe: {
      title: string;
      steps: { step: number; action: string; detail: string }[];
      timeEstimate: string;
    };
    relatedPrinciples: string[];
    prompts: {
      audit: string;
      refactor: string;
    };
  };
  error?: string;
} {
  try {
    const smell = getSmell(id);

    if (!smell) {
      return {
        success: false,
        error: `Smell not found: ${id}. Use list_smells to see available smells.`
      };
    }

    const isSpanish = locale === 'es';

    return {
      success: true,
      smell: {
        id: smell.id,
        name: isSpanish ? smell.nameEs : smell.name,
        tagline: isSpanish ? smell.taglineEs : smell.tagline,
        symptoms: isSpanish ? smell.symptomsEs : smell.symptoms,
        nielsenHeuristic: smell.nielsenHeuristic,
        nielsenName: isSpanish ? smell.nielsenNameEs : smell.nielsenName,
        recipe: {
          title: isSpanish ? smell.recipe.titleEs : smell.recipe.title,
          steps: smell.recipe.steps.map(s => ({
            step: s.step,
            action: isSpanish ? s.actionEs : s.action,
            detail: isSpanish ? s.detailEs : s.detail
          })),
          timeEstimate: isSpanish ? smell.recipe.timeEstimateEs : smell.recipe.timeEstimate
        },
        relatedPrinciples: smell.relatedPrinciples,
        prompts: {
          audit: smell.prompts.audit.text,
          refactor: smell.prompts.refactor.text
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Error fetching smell: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Tool: list_smells
 * List all UX smells (anti-patterns)
 */
export function listSmellsTool(
  category?: string,
  locale: Locale = 'en'
): {
  success: boolean;
  smells?: {
    id: string;
    name: string;
    shortName: string;
    tagline: string;
    category: string;
    nielsenHeuristic: number;
  }[];
  categories?: string[];
  error?: string;
} {
  try {
    const allSmells = loadSmells();
    const isSpanish = locale === 'es';

    // Get unique categories
    const categories = [...new Set(allSmells.map(s => s.category))].sort();

    // Filter by category if specified
    const filtered = category
      ? allSmells.filter(s => s.category === category)
      : allSmells;

    const smells = filtered.map(s => ({
      id: s.id,
      name: isSpanish ? s.nameEs : s.name,
      shortName: isSpanish ? s.shortNameEs : s.shortName,
      tagline: isSpanish ? s.taglineEs : s.tagline,
      category: s.category,
      nielsenHeuristic: s.nielsenHeuristic
    }));

    return {
      success: true,
      smells,
      categories
    };
  } catch (error) {
    return {
      success: false,
      error: `Error listing smells: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Tool: detect_smell
 * Detect potential UX smells based on a description
 */
export function detectSmellTool(
  description: string,
  locale: Locale = 'en'
): {
  success: boolean;
  detections?: {
    smell: {
      id: string;
      name: string;
      tagline: string;
    };
    confidence: 'high' | 'medium' | 'low';
    matchedKeywords: string[];
    suggestedFix: string;
  }[];
  note?: string;
  catalog?: { id: string; name: string; tagline: string; symptoms: string[] }[];
  error?: string;
} {
  try {
    const allSmells = loadSmells();
    const isSpanish = locale === 'es';
    const descLower = description.toLowerCase();

    const detections: {
      smell: { id: string; name: string; tagline: string };
      confidence: 'high' | 'medium' | 'low';
      matchedKeywords: string[];
      suggestedFix: string;
    }[] = [];

    for (const smell of allSmells) {
      // Both languages are matched whatever `locale` says: the locale picks the
      // language of the answer, not the language the caller wrote in.
      const keywords = SMELL_KEYWORDS[smell.id] ?? [];
      const matchedKeywords = keywords.filter(kw => descLower.includes(kw.toLowerCase()));

      // Also check symptoms
      const symptoms = isSpanish ? smell.symptomsEs : smell.symptoms;
      const matchedSymptoms = symptoms.filter(sym =>
        descLower.includes(sym.toLowerCase().slice(0, 20))
      );

      const totalMatches = matchedKeywords.length + matchedSymptoms.length;

      if (totalMatches > 0) {
        const confidence: 'high' | 'medium' | 'low' =
          totalMatches >= 3 ? 'high' :
          totalMatches >= 2 ? 'medium' : 'low';

        detections.push({
          smell: {
            id: smell.id,
            name: isSpanish ? smell.nameEs : smell.name,
            tagline: isSpanish ? smell.taglineEs : smell.tagline
          },
          confidence,
          matchedKeywords: [...matchedKeywords, ...matchedSymptoms.map(s => s.slice(0, 30))],
          suggestedFix: `Apply fix recipe for "${smell.name}": ${smell.recipe.steps[0]?.action || 'See get_smell for details'}`
        });
      }
    }

    // No keyword/symptom match: return the full catalog and let the calling
    // model classify from natural language (it is the better classifier).
    if (detections.length === 0) {
      return {
        success: true,
        detections: [],
        note: 'No keyword match. Review this catalog of UX smells and decide which (if any) fit the described issue, then call get_smell with the chosen id.',
        catalog: allSmells.map(s => ({
          id: s.id,
          name: isSpanish ? s.nameEs : s.name,
          tagline: isSpanish ? s.taglineEs : s.tagline,
          symptoms: isSpanish ? s.symptomsEs : s.symptoms
        }))
      };
    }

    // Sort by confidence
    detections.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.confidence] - order[b.confidence];
    });

    return {
      success: true,
      detections: detections.slice(0, 5) // Top 5 detections
    };
  } catch (error) {
    return {
      success: false,
      error: `Error detecting smells: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Tool: suggest_fix
 * Get a fix suggestion for a specific UX issue
 */
export function suggestFixTool(
  issue: string,
  smellId?: string,
  locale: Locale = 'en'
): {
  success: boolean;
  suggestion?: {
    diagnosis: string;
    smell?: { id: string; name: string };
    fixSteps: string[];
    relatedPrinciples: string[];
    prompt: string;
  };
  error?: string;
} {
  try {
    const isSpanish = locale === 'es';

    // If smell ID provided, use that directly
    if (smellId) {
      const smell = getSmell(smellId);
      if (!smell) {
        return { success: false, error: `Smell not found: ${smellId}` };
      }

      return {
        success: true,
        suggestion: {
          diagnosis: `Identified as "${isSpanish ? smell.nameEs : smell.name}"`,
          smell: { id: smell.id, name: isSpanish ? smell.nameEs : smell.name },
          fixSteps: smell.recipe.steps.map(s => isSpanish ? s.actionEs : s.action),
          relatedPrinciples: smell.relatedPrinciples,
          prompt: smell.prompts.refactor.text.replace('{{screen_description}}', issue)
        }
      };
    }

    // Otherwise, detect smell first
    const detection = detectSmellTool(issue, locale);
    if (!detection.success || !detection.detections?.length) {
      return {
        success: true,
        suggestion: {
          diagnosis: 'No specific UX smell detected. Consider these general improvements:',
          fixSteps: [
            'Review visual hierarchy - is the primary action clear?',
            'Check cognitive load - are there too many choices?',
            'Verify feedback - do users know what happened?',
            'Test error handling - are errors helpful and actionable?'
          ],
          relatedPrinciples: ['cognitive-load', 'visual-hierarchy', 'feedback', 'error-prevention'],
          prompt: `Analyze this UI for potential UX issues and suggest improvements:\n\n${issue}`
        }
      };
    }

    // Use top detection
    const topDetection = detection.detections[0];
    const smell = getSmell(topDetection.smell.id);

    if (!smell) {
      return { success: false, error: 'Could not load smell details' };
    }

    return {
      success: true,
      suggestion: {
        diagnosis: `Detected "${topDetection.smell.name}" (${topDetection.confidence} confidence)`,
        smell: topDetection.smell,
        fixSteps: smell.recipe.steps.map(s => isSpanish ? s.actionEs : s.action),
        relatedPrinciples: smell.relatedPrinciples,
        prompt: smell.prompts.refactor.text.replace('{{screen_description}}', issue)
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Error suggesting fix: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
