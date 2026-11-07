/**
 * Tool: audit_interface (pro mode)
 *
 * Sends a natural-language description of a screen to POST /api/v1/audit and
 * returns the findings mapped to principles and smells. Pro only: the free
 * server answers with the hint and points at detect_smell + suggest_fix,
 * which run offline on the bundled catalogue.
 */

import { apiRequest, isProMode, PRO_HINT } from '../api-client.js';

export type AuditContext = 'figma' | 'web' | 'mobile' | 'email';
export type AuditDepth = 'quick' | 'full';

export interface AuditFinding {
  id: string;
  principle: { code: string; slug: string; title: string; part: string };
  severity: 'critical' | 'warning' | 'suggestion';
  message: string;
  remediation: string;
  business_impact: string | null;
  smell_id: string | null;
}

export interface AuditData {
  interface_type: string;
  overall_score: number;
  band: 'poor' | 'fair' | 'good' | 'excellent';
  findings: AuditFinding[];
  smells_detected: string[];
  strengths: { principle: { code: string; slug: string; title: string } | null; message: string }[];
  priority_fixes: string[];
  audit_depth: AuditDepth;
}

export const AUDIT_MIN_CHARS = 20;
export const AUDIT_MAX_CHARS = 5000;

export async function auditInterfaceTool(
  description: string,
  locale: 'en' | 'es' = 'en',
  context?: AuditContext,
  depth: AuditDepth = 'full'
): Promise<{
  success: boolean;
  tier: 'free' | 'pro';
  audit?: AuditData;
  error?: string;
  code?: string;
  freeAlternative?: string;
}> {
  if (!isProMode()) {
    return {
      success: false,
      tier: 'free',
      code: 'PRO_REQUIRED',
      error: `audit_interface needs a Principles Library API key. ${PRO_HINT}`,
      freeAlternative:
        'Without a key, call detect_smell with the same description, then suggest_fix or get_smell for the recipe. Both run offline.',
    };
  }

  const result = await apiRequest<AuditData>('/audit', {
    method: 'POST',
    body: { description, locale, context, depth },
  });

  if (!result.ok) {
    return {
      success: false,
      tier: 'pro',
      code: result.code,
      error: `Audit request failed (${result.code}): ${result.message}`,
      freeAlternative: 'detect_smell and suggest_fix still work offline with the bundled catalogue.',
    };
  }

  return { success: true, tier: 'pro', audit: result.data };
}
