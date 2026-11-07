/**
 * UX/UI Principles Data Types
 *
 * These types define the structure of all principle-related data
 * used across AI Context Packs, MCP Server, and other products.
 */

// =============================================================================
// PRINCIPLES
// =============================================================================

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Locale = 'en' | 'es';

/**
 * A UX/UI principle with full metadata
 */
export interface Principle {
  /** URL-safe identifier (e.g., 'cognitive-load', 'hicks-law') */
  slug: string;
  /** Principle name (e.g., 'Cognitive Load Theory') */
  title: string;
  /** Unique code (e.g., 'F.1.1.01') */
  code: string;
  /** Part folder (e.g., 'part-1') */
  part: string;
  /** CSS color variable for this part */
  partColor: string;
  /** Human-readable part name (e.g., 'Foundations') */
  partName: string;
  /** Difficulty level */
  difficulty: Difficulty;
  /** Estimated read time in minutes */
  readTime: number;
  /** Short AI-generated summary */
  aiSummary?: string;
  /** Topic tags */
  tags?: string[];
  /**
   * Bibliographic references behind the principle (the MDX `furtherReading`
   * frontmatter). Public bibliographic data, not the paywalled guide body.
   */
  citations?: Citation[];
}

/**
 * One bibliographic reference behind a principle
 */
export interface Citation {
  author: string;
  title: string;
  /** Publication year; a few sources carry a range or "n.d." as text */
  year?: number | string;
  url?: string;
  publisher?: string;
}

/**
 * Full principle with content (MDX body)
 */
export interface PrincipleWithContent extends Principle {
  /** Raw MDX content */
  content: string;
  /** Parsed frontmatter */
  frontmatter: Record<string, unknown>;
}

/**
 * Minimal principle for lists/search
 */
export interface PrincipleSummary {
  slug: string;
  title: string;
  code: string;
  partName: string;
  aiSummary?: string;
}

// =============================================================================
// SMELLS (Anti-patterns)
// =============================================================================

/**
 * Recipe step for fixing a smell
 */
export interface RecipeStep {
  step: number;
  action: string;
  actionEs: string;
  detail: string;
  detailEs: string;
}

/**
 * Fix recipe for a smell
 */
export interface Recipe {
  title: string;
  titleEs: string;
  steps: RecipeStep[];
  timeEstimate: string;
  timeEstimateEs: string;
}

/**
 * Prompt for auditing or refactoring
 */
export interface SmellPrompt {
  type: 'audit' | 'refactor';
  role: string;
  text: string;
}

/**
 * UX Smell (anti-pattern)
 */
export interface Smell {
  /** Unique identifier */
  id: string;
  /** Display name (English) */
  name: string;
  /** Display name (Spanish) */
  nameEs: string;
  /** Short name for UI */
  shortName: string;
  shortNameEs: string;
  /** Category (efficiency, usability, etc.) */
  category: string;
  /** Nielsen heuristic number (1-10) */
  nielsenHeuristic: number;
  /** Nielsen heuristic name */
  nielsenName: string;
  nielsenNameEs: string;
  /** Icon name (Phosphor icons) */
  icon: string;
  /** Short description */
  tagline: string;
  taglineEs: string;
  /** Symptom indicators */
  symptoms: string[];
  symptomsEs: string[];
  /** Time to detect */
  detectionTime: string;
  detectionTimeEs: string;
  /** Related principle slugs */
  relatedPrinciples: string[];
  /** Related flow IDs */
  relatedFlows: string[];
  /** Metrics this affects */
  metricImpact: string[];
  /** Fix recipe */
  recipe: Recipe;
  /** Audit and refactor prompts */
  prompts: {
    audit: SmellPrompt;
    refactor: SmellPrompt;
  };
  /** Before/after examples */
  examples: {
    before: string;
    beforeEs: string;
    after: string;
    afterEs: string;
  };
}

// =============================================================================
// FLOWS (User Journey Checklists)
// =============================================================================

/**
 * Pre-flight checklist item
 */
export interface PreflightItem {
  id: string;
  question: string;
  questionEs: string;
  why: string;
  whyEs: string;
  principle: string;
}

/**
 * Post-flight checklist item
 */
export interface PostflightItem {
  id: string;
  check: string;
  checkEs: string;
  smell: string;
  severity: Severity;
}

/**
 * Pre-flight checklist section
 */
export interface Preflight {
  title: string;
  titleEs: string;
  description: string;
  descriptionEs: string;
  items: PreflightItem[];
}

/**
 * Post-flight checklist section
 */
export interface Postflight {
  title: string;
  titleEs: string;
  description: string;
  descriptionEs: string;
  items: PostflightItem[];
}

/**
 * User flow with checklists
 */
export interface Flow {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  nameEs: string;
  /** Icon name (Phosphor icons) */
  icon: string;
  /** Target metric */
  metricTarget: string;
  /** Description */
  description: string;
  descriptionEs: string;
  /** Common smells in this flow */
  commonSmells: string[];
  /** Key principles for this flow */
  keyPrinciples: string[];
  /** Pre-design checklist */
  preflight: Preflight;
  /** Pre-ship checklist */
  postflight: Postflight;
}

// =============================================================================
// COLLECTIONS
// =============================================================================

export interface SmellsData {
  smells: Smell[];
}

export interface FlowsData {
  flows: Flow[];
}

// =============================================================================
// SEARCH & FILTERS
// =============================================================================

export interface PrincipleFilter {
  part?: string;
  difficulty?: Difficulty;
  tags?: string[];
  search?: string;
}

export interface SmellFilter {
  category?: string;
  nielsenHeuristic?: number;
  relatedPrinciple?: string;
}

export interface FlowFilter {
  metricTarget?: string;
  commonSmell?: string;
}

// =============================================================================
// MCP SERVER TYPES
// =============================================================================

/**
 * Context for generating prompts
 */
export interface PromptContext {
  /** UI element or screen being designed */
  element: string;
  /** Target platform */
  platform?: 'web' | 'mobile' | 'desktop';
  /** User context */
  userContext?: string;
  /** Specific concern or focus area */
  concern?: string;
}

/**
 * Generated prompt result
 */
export interface GeneratedPrompt {
  /** The formatted prompt text */
  prompt: string;
  /** Principles used to generate */
  principles: string[];
  /** Suggested follow-up prompts */
  suggestions?: string[];
}

/**
 * Smell detection result
 */
export interface SmellDetection {
  /** Detected smell */
  smell: Smell;
  /** Confidence score (0-1) */
  confidence: number;
  /** Matched symptoms */
  matchedSymptoms: string[];
  /** Suggested fix prompt */
  fixPrompt: string;
}
