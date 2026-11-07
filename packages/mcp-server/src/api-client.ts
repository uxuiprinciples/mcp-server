/**
 * Pro-mode client for the uxuiprinciples.com REST API.
 *
 * The server is free and offline by default. When UXUI_API_KEY is set (the
 * key that comes with the Principles Library), three tools go through the
 * API: get_principle (full guide body), get_principle_prompts (the AI prompts)
 * and audit_interface (POST /api/v1/audit). Nothing else ever touches the
 * network, and the key is read from the environment only, never logged.
 *
 * UXUI_API_BASE_URL exists for the smoke test, which points it at a local
 * fake; it is not a user setting.
 */

export const API_KEY_ENV = 'UXUI_API_KEY';
const BASE_URL_ENV = 'UXUI_API_BASE_URL';
const DEFAULT_BASE_URL = 'https://uxuiprinciples.com';
const TIMEOUT_MS = 15000;

const SERVER_VERSION = process.env.MCP_SERVER_VERSION || '0.0.0-dev';

export const PRO_HINT =
  `Set ${API_KEY_ENV} to the API key of your Principles Library (uxuiprinciples.com/account) to unlock it. ` +
  'The key ships with the $59/year Library: https://uxuiprinciples.com/en/developers';

export type ApiResult<T> =
  | { ok: true; data: T; tier: 'free' | 'pro' | 'unknown' }
  | { ok: false; status: number; code: string; message: string };

export function getApiKey(): string | undefined {
  const key = process.env[API_KEY_ENV]?.trim();
  return key ? key : undefined;
}

export function isProMode(): boolean {
  return getApiKey() !== undefined;
}

export function apiBaseUrl(): string {
  return (process.env[BASE_URL_ENV] || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, string | undefined>;
  body?: unknown;
}

/**
 * One request against /api/v1. Every failure comes back as a value
 * ({ ok: false }) so the tools can degrade to the bundled data and tell the
 * caller what happened instead of throwing into the MCP transport.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, status: 401, code: 'MISSING_API_KEY', message: PRO_HINT };
  }

  const url = new URL(`/api/v1${path}`, `${apiBaseUrl()}/`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `uxui-mcp/${SERVER_VERSION}`,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    let payload: {
      success?: boolean;
      data?: T;
      meta?: { tier?: 'free' | 'pro' };
      error?: { code?: string; message?: string };
    } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      // Non-JSON body (proxy page, empty 5xx); fall through to the status check.
    }

    if (!response.ok || payload.success === false || payload.data === undefined) {
      return {
        ok: false,
        status: response.status,
        code: payload.error?.code ?? `HTTP_${response.status}`,
        message: payload.error?.message ?? `API answered ${response.status} for ${path}`,
      };
    }

    return { ok: true, data: payload.data, tier: payload.meta?.tier ?? 'unknown' };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      code: aborted ? 'TIMEOUT' : 'NETWORK',
      message: aborted
        ? `API request timed out after ${TIMEOUT_MS / 1000}s`
        : `API request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Shape of one principle as /api/v1/principles returns it in pro mode. */
export interface ApiPrinciple {
  slug: string;
  title: string;
  code: string;
  part: string;
  partName: string;
  difficulty: string;
  readTime: number;
  aiSummary?: string;
  tags?: string[];
  content?: string;
  frontmatter?: Record<string, unknown>;
}

export function fetchPrinciple(slug: string, locale: 'en' | 'es'): Promise<ApiResult<ApiPrinciple>> {
  return apiRequest<ApiPrinciple>('/principles', {
    query: { slug, locale, include_content: 'true' },
  });
}
