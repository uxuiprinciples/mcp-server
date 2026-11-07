/**
 * API Client for UX/UI Principles
 *
 * Fetches data from the uxuiprinciples.com API instead of bundled files.
 * This protects the intellectual property by requiring authentication.
 *
 * Usage:
 *   const client = createApiClient({ apiKey: 'uxui_live_xxx' });
 *   const principles = await client.getPrinciples();
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

// =============================================================================
// TYPES
// =============================================================================

export interface ApiClientConfig {
  /** API key for Pro tier access. Omit for free tier. */
  apiKey?: string;
  /** Base URL for API (defaults to https://uxuiprinciples.com) */
  baseUrl?: string;
  /** Request timeout in ms (defaults to 30000) */
  timeout?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: {
    timestamp: string;
    version: string;
    tier: 'free' | 'pro';
    count?: number;
    total?: number;
    locale?: string;
    filters?: Record<string, string | null>;
  };
  error?: {
    message: string;
    code: string;
    status: number;
  };
}

export interface ApiClient {
  /** Get current access tier */
  getTier(): 'free' | 'pro';

  // Principles
  getPrinciples(options?: {
    locale?: Locale;
    part?: string;
    difficulty?: string;
    search?: string;
    includeContent?: boolean;
  }): Promise<Principle[]>;

  getPrinciple(slug: string, options?: {
    locale?: Locale;
    includeContent?: boolean;
  }): Promise<PrincipleWithContent | null>;

  searchPrinciples(filter?: PrincipleFilter, locale?: Locale): Promise<Principle[]>;

  getPrincipleSummaries(locale?: Locale): Promise<PrincipleSummary[]>;

  // Smells (Pro only)
  getSmells(options?: {
    category?: string;
    heuristic?: number;
  }): Promise<Smell[]>;

  getSmell(id: string): Promise<Smell | null>;

  searchSmells(filter?: SmellFilter): Promise<Smell[]>;

  // Flows (Pro only)
  getFlows(options?: {
    metric?: string;
  }): Promise<Flow[]>;

  getFlow(id: string): Promise<Flow | null>;

  searchFlows(filter?: FlowFilter): Promise<Flow[]>;

  // Cache
  clearCache(): void;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

const DEFAULT_BASE_URL = 'https://uxuiprinciples.com';
const DEFAULT_TIMEOUT = 30000;

// In-memory cache
interface Cache {
  principles: Map<string, { data: Principle[]; timestamp: number }>;
  smells: { data: Smell[]; timestamp: number } | null;
  flows: { data: Flow[]; timestamp: number } | null;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Create an API client for fetching UX/UI Principles data
 */
export function createApiClient(config: ApiClientConfig = {}): ApiClient {
  const {
    apiKey,
    baseUrl = DEFAULT_BASE_URL,
    timeout = DEFAULT_TIMEOUT,
  } = config;

  const tier: 'free' | 'pro' = apiKey ? 'pro' : 'free';

  // Initialize cache
  const cache: Cache = {
    principles: new Map(),
    smells: null,
    flows: null,
  };

  /**
   * Make an API request
   */
  async function fetchApi<T>(
    endpoint: string,
    params: Record<string, string | undefined> = {}
  ): Promise<ApiResponse<T>> {
    // Build URL with params
    const url = new URL(`/api/v1${endpoint}`, baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    });

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Make request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json() as ApiResponse<T>;

      if (!response.ok) {
        throw new Error(data.error?.message || `API error: ${response.status}`);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('API request timed out');
      }
      throw error;
    }
  }

  /**
   * Check if cache entry is valid
   */
  function isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_TTL;
  }

  return {
    getTier() {
      return tier;
    },

    async getPrinciples(options = {}) {
      const {
        locale = 'en',
        part,
        difficulty,
        search,
        includeContent,
      } = options;

      // Check cache (only for unfiltered requests)
      const cacheKey = `${locale}`;
      const cached = cache.principles.get(cacheKey);
      if (!part && !difficulty && !search && !includeContent && cached && isCacheValid(cached.timestamp)) {
        return cached.data;
      }

      const response = await fetchApi<Principle[]>('/principles', {
        locale,
        part,
        difficulty,
        search,
        include_content: includeContent ? 'true' : undefined,
      });

      // Cache unfiltered results
      if (!part && !difficulty && !search && !includeContent) {
        cache.principles.set(cacheKey, {
          data: response.data,
          timestamp: Date.now(),
        });
      }

      return response.data;
    },

    async getPrinciple(slug, options = {}) {
      const { locale = 'en', includeContent = true } = options;

      const response = await fetchApi<PrincipleWithContent>('/principles', {
        locale,
        slug,
        include_content: includeContent ? 'true' : undefined,
      });

      return response.data || null;
    },

    async searchPrinciples(filter, locale = 'en') {
      return this.getPrinciples({
        locale,
        part: filter?.part,
        difficulty: filter?.difficulty,
        search: filter?.search,
      });
    },

    async getPrincipleSummaries(locale = 'en') {
      const principles = await this.getPrinciples({ locale });
      return principles.map(p => ({
        slug: p.slug,
        title: p.title,
        code: p.code,
        partName: p.partName,
        aiSummary: p.aiSummary,
      }));
    },

    async getSmells(options = {}) {
      const { category, heuristic } = options;

      // Check cache (only for unfiltered requests)
      if (!category && !heuristic && cache.smells && isCacheValid(cache.smells.timestamp)) {
        return cache.smells.data;
      }

      const response = await fetchApi<Smell[]>('/smells', {
        category,
        heuristic: heuristic?.toString(),
      });

      // Cache unfiltered results
      if (!category && !heuristic) {
        cache.smells = {
          data: response.data,
          timestamp: Date.now(),
        };
      }

      return response.data;
    },

    async getSmell(id) {
      const response = await fetchApi<Smell>('/smells', { id });
      return response.data || null;
    },

    async searchSmells(filter) {
      return this.getSmells({
        category: filter?.category,
        heuristic: filter?.nielsenHeuristic,
      });
    },

    async getFlows(options = {}) {
      const { metric } = options;

      // Check cache (only for unfiltered requests)
      if (!metric && cache.flows && isCacheValid(cache.flows.timestamp)) {
        return cache.flows.data;
      }

      const response = await fetchApi<Flow[]>('/flows', { metric });

      // Cache unfiltered results
      if (!metric) {
        cache.flows = {
          data: response.data,
          timestamp: Date.now(),
        };
      }

      return response.data;
    },

    async getFlow(id) {
      const response = await fetchApi<Flow>('/flows', { id });
      return response.data || null;
    },

    async searchFlows(filter) {
      return this.getFlows({
        metric: filter?.metricTarget,
      });
    },

    clearCache() {
      cache.principles.clear();
      cache.smells = null;
      cache.flows = null;
    },
  };
}

// =============================================================================
// SINGLETON CLIENT (for convenience)
// =============================================================================

let defaultClient: ApiClient | null = null;

/**
 * Initialize the default API client
 * Call this once at app startup with your API key
 */
export function initApiClient(config: ApiClientConfig = {}): ApiClient {
  // Check for environment variable
  const apiKey = config.apiKey || process.env.UXUI_API_KEY;

  defaultClient = createApiClient({
    ...config,
    apiKey,
  });

  return defaultClient;
}

/**
 * Get the default API client
 * Throws if not initialized
 */
export function getApiClient(): ApiClient {
  if (!defaultClient) {
    // Auto-initialize with environment variable
    defaultClient = createApiClient({
      apiKey: process.env.UXUI_API_KEY,
    });
  }
  return defaultClient;
}
