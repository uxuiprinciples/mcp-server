/**
 * Flow-related MCP tools (User Journey Checklists)
 */

import {
  loadFlows,
  getFlow,
  type Locale
} from '@uxuiprinciples/principles-data';

/**
 * Tool: get_flow
 * Get a user flow with pre-flight and post-flight checklists
 */
export function getFlowTool(id: string, locale: Locale = 'en'): {
  success: boolean;
  flow?: {
    id: string;
    name: string;
    description: string;
    metricTarget: string;
    keyPrinciples: string[];
    commonSmells: string[];
    preflight: {
      title: string;
      description: string;
      items: { id: string; question: string; why: string; principle: string }[];
    };
    postflight: {
      title: string;
      description: string;
      items: { id: string; check: string; smell: string; severity: string }[];
    };
  };
  error?: string;
} {
  try {
    const flow = getFlow(id);

    if (!flow) {
      return {
        success: false,
        error: `Flow not found: ${id}. Use list_flows to see available flows.`
      };
    }

    const isSpanish = locale === 'es';

    return {
      success: true,
      flow: {
        id: flow.id,
        name: isSpanish ? flow.nameEs : flow.name,
        description: isSpanish ? flow.descriptionEs : flow.description,
        metricTarget: flow.metricTarget,
        keyPrinciples: flow.keyPrinciples,
        commonSmells: flow.commonSmells,
        preflight: {
          title: isSpanish ? flow.preflight.titleEs : flow.preflight.title,
          description: isSpanish ? flow.preflight.descriptionEs : flow.preflight.description,
          items: flow.preflight.items.map(item => ({
            id: item.id,
            question: isSpanish ? item.questionEs : item.question,
            why: isSpanish ? item.whyEs : item.why,
            principle: item.principle
          }))
        },
        postflight: {
          title: isSpanish ? flow.postflight.titleEs : flow.postflight.title,
          description: isSpanish ? flow.postflight.descriptionEs : flow.postflight.description,
          items: flow.postflight.items.map(item => ({
            id: item.id,
            check: isSpanish ? item.checkEs : item.check,
            smell: item.smell,
            severity: item.severity
          }))
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Error fetching flow: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Tool: list_flows
 * List all available user flows
 */
export function listFlowsTool(locale: Locale = 'en'): {
  success: boolean;
  flows?: {
    id: string;
    name: string;
    description: string;
    metricTarget: string;
    checklistCount: { preflight: number; postflight: number };
  }[];
  error?: string;
} {
  try {
    const allFlows = loadFlows();
    const isSpanish = locale === 'es';

    const flows = allFlows.map(flow => ({
      id: flow.id,
      name: isSpanish ? flow.nameEs : flow.name,
      description: isSpanish ? flow.descriptionEs : flow.description,
      metricTarget: flow.metricTarget,
      checklistCount: {
        preflight: flow.preflight.items.length,
        postflight: flow.postflight.items.length
      }
    }));

    return {
      success: true,
      flows
    };
  } catch (error) {
    return {
      success: false,
      error: `Error listing flows: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Tool: generate_checklist
 * Generate a checklist for a specific flow phase
 */
export function generateChecklistTool(
  flowId: string,
  phase: 'preflight' | 'postflight',
  locale: Locale = 'en'
): {
  success: boolean;
  checklist?: {
    flow: string;
    phase: string;
    title: string;
    description: string;
    items: {
      id: string;
      text: string;
      detail?: string;
      severity?: string;
      related: string; // principle or smell
    }[];
    markdown: string;
  };
  error?: string;
} {
  try {
    const flow = getFlow(flowId);

    if (!flow) {
      return {
        success: false,
        error: `Flow not found: ${flowId}. Use list_flows to see available flows.`
      };
    }

    const isSpanish = locale === 'es';
    const checklistData = flow[phase];

    const items = phase === 'preflight'
      ? flow.preflight.items.map(item => ({
          id: item.id,
          text: isSpanish ? item.questionEs : item.question,
          detail: isSpanish ? item.whyEs : item.why,
          related: item.principle
        }))
      : flow.postflight.items.map(item => ({
          id: item.id,
          text: isSpanish ? item.checkEs : item.check,
          severity: item.severity,
          related: item.smell
        }));

    // Generate markdown checklist
    const markdown = `# ${isSpanish ? checklistData.titleEs : checklistData.title}

${isSpanish ? checklistData.descriptionEs : checklistData.description}

## Checklist

${items.map(item => {
  if ('detail' in item) {
    return `- [ ] **${item.text}**\n  - _Why:_ ${item.detail}\n  - _Principle:_ ${item.related}`;
  } else {
    return `- [ ] [${item.severity?.toUpperCase()}] ${item.text}\n  - _Smell to avoid:_ ${item.related}`;
  }
}).join('\n\n')}
`;

    return {
      success: true,
      checklist: {
        flow: isSpanish ? flow.nameEs : flow.name,
        phase,
        title: isSpanish ? checklistData.titleEs : checklistData.title,
        description: isSpanish ? checklistData.descriptionEs : checklistData.description,
        items,
        markdown
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Error generating checklist: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Tool: get_flow_principles
 * Get key principles for a specific flow
 */
export function getFlowPrinciplesTool(
  flowId: string,
  locale: Locale = 'en'
): {
  success: boolean;
  flow?: { id: string; name: string };
  principles?: string[];
  smells?: string[];
  error?: string;
} {
  try {
    const flow = getFlow(flowId);

    if (!flow) {
      return {
        success: false,
        error: `Flow not found: ${flowId}`
      };
    }

    const isSpanish = locale === 'es';

    return {
      success: true,
      flow: {
        id: flow.id,
        name: isSpanish ? flow.nameEs : flow.name
      },
      principles: flow.keyPrinciples,
      smells: flow.commonSmells
    };
  } catch (error) {
    return {
      success: false,
      error: `Error fetching flow principles: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
