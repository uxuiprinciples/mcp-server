/**
 * @uxuiprinciples/principles-data
 *
 * Shared data layer for UX/UI Principles: the full principle taxonomy
 * (public metadata + summaries), UX smells, and flow checklists.
 *
 * The loaders below serve data compiled into the bundle at build time (no
 * filesystem or network access). Full principle bodies stay behind the
 * Principles Library paywall and are not bundled; getPrinciple returns the
 * summary plus a link to the full guide.
 *
 * An optional API client (getApiClient/createApiClient) can fetch live data
 * from the uxuiprinciples.com API if you prefer that over the bundled dataset.
 */

import { principles, smells, flows } from './generated/dataset';

// Re-export all types
export * from './types';

// Re-export API client (recommended)
export {
  createApiClient,
  initApiClient,
  getApiClient,
  type ApiClient,
  type ApiClientConfig,
  type ApiResponse,
} from './api-client';

// Re-export loaders (serve the bundled dataset; work in the published package)
export {
  // Principles
  loadPrinciples,
  getPrinciple,
  searchPrinciples,
  getPrincipleSummaries,
  // Smells
  loadSmells,
  getSmell,
  searchSmells,
  // Flows
  loadFlows,
  getFlow,
  searchFlows,
  // Cache management
  clearCache
} from './loaders';

// Version info
//
// PRINCIPLE_COUNT is derived from the compiled dataset, never written by hand.
// It was hardcoded at 185 and went stale the moment Part 6 shipped, while the
// bundled data was already correct: the published server then described itself
// with one number and answered with another.
// VERSION is stamped from package.json by tsup's --env.PRINCIPLES_DATA_VERSION
// (see the build script), the same way the MCP server stamps its own; a
// hand-typed literal lagged one release behind on every publish.
export const VERSION: string = process.env.PRINCIPLES_DATA_VERSION || '0.0.0-dev';
export const PRINCIPLE_COUNT = principles.en.length;
export const SMELL_COUNT = smells.length;
export const FLOW_COUNT = flows.length;
// The next two cannot be derived from the bundled data (references live in the
// MDX bodies, the free list on the site). scripts/sync-content-counts.js in
// the repository root rewrites them when the sources move.
export const CITATION_COUNT = 2400;
export const FREE_PRINCIPLE_COUNT = 12;
