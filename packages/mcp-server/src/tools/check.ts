/**
 * Tool: check_requirements (pro mode)
 *
 * Sends a screen described as data (flow, components, actions with flags,
 * states implemented) to POST /api/v1/check and returns a pass, fail or
 * not_applicable per required-state rule, each with the principle it comes
 * from and that principle's citations. Pro only: the free server answers with
 * the key hint and points at generate_checklist, which lists the same ground
 * as unevaluated questions.
 */

import { apiRequest, isProMode, PRO_HINT } from '../api-client.js';

export const CHECK_STATES = [
  'loading',
  'empty',
  'error',
  'success',
  'confirmation',
  'undo',
  'edit',
  'sources',
  'recovery',
  'consent',
] as const;

export type CheckState = (typeof CHECK_STATES)[number];

export interface CheckAction {
  label: string;
  consequential?: boolean;
  automated?: boolean;
}

export interface CheckInput {
  flow?: string;
  components?: string[];
  actions?: CheckAction[];
  states_implemented?: CheckState[];
  locale?: 'en' | 'es';
}

export interface CheckRule {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'not_applicable';
  rule: string;
  required_because: string | null;
  satisfied_by: CheckState[];
  principle: { code: string; slug: string; title: string; url: string };
  citations: { author: string; title: string; year?: number | string; url?: string }[];
}

export interface CheckData {
  verdict: 'pass' | 'fail' | 'no_rules_applied';
  applicable: number;
  passed: number;
  failed: number;
  rules: CheckRule[];
  summary_markdown: string;
}

export async function checkRequirementsTool(input: CheckInput): Promise<{
  success: boolean;
  tier: 'free' | 'pro';
  check?: CheckData;
  error?: string;
  code?: string;
  freeAlternative?: string;
}> {
  if (!isProMode()) {
    return {
      success: false,
      tier: 'free',
      code: 'PRO_REQUIRED',
      error: `check_requirements needs a Principles Library API key. ${PRO_HINT}`,
      freeAlternative:
        'Without a key, call generate_checklist with the flow id and phase "postflight" for the unevaluated checklist, and get_principle for the citations. Both run offline.',
    };
  }

  const result = await apiRequest<CheckData>('/check', {
    method: 'POST',
    body: {
      flow: input.flow,
      components: input.components ?? [],
      actions: input.actions ?? [],
      states_implemented: input.states_implemented ?? [],
      locale: input.locale ?? 'en',
    },
  });

  if (!result.ok) {
    return {
      success: false,
      tier: 'pro',
      code: result.code,
      error: `Check request failed (${result.code}): ${result.message}`,
      freeAlternative: 'generate_checklist still works offline with the bundled catalogue.',
    };
  }

  return { success: true, tier: 'pro', check: result.data };
}
