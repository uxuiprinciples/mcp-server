#!/usr/bin/env node

/**
 * @uxuiprinciples/mcp-server
 *
 * MCP Server for UX/UI Principles
 * Provides agentic AI tools for Claude Code and Claude Desktop
 *
 * Installation:
 *   npm install -g @uxuiprinciples/mcp-server
 *
 * Claude Desktop config:
 *   {
 *     "mcpServers": {
 *       "uxui-principles": {
 *         "command": "npx",
 *         "args": ["-y", "@uxuiprinciples/mcp-server"]
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { FLOW_COUNT, PRINCIPLE_COUNT, SMELL_COUNT, loadFlows } from '@uxuiprinciples/principles-data';

// Import tool implementations
import {
  getPrincipleTool,
  searchPrinciplesTool,
  listPrinciplesTool,
  getPrinciplePromptsTool
} from './tools/principles.js';
import {
  getSmellTool,
  listSmellsTool,
  detectSmellTool,
  suggestFixTool
} from './tools/smells.js';
import {
  getFlowTool,
  listFlowsTool,
  generateChecklistTool,
  getFlowPrinciplesTool
} from './tools/flows.js';
import { auditInterfaceTool, AUDIT_MAX_CHARS, AUDIT_MIN_CHARS } from './tools/audit.js';
import { checkRequirementsTool, CHECK_STATES, type CheckInput } from './tools/check.js';
import { API_KEY_ENV, isProMode } from './api-client.js';

// Server info. SERVER_VERSION is injected at build time from package.json via
// tsup's --env.MCP_SERVER_VERSION $npm_package_version (see build script), so it
// never drifts from the published npm version. Falls back for non-npm builds.
const SERVER_NAME = 'uxui-principles';
const SERVER_VERSION = process.env.MCP_SERVER_VERSION || '0.0.0-dev';

// Flow ids come from the bundled dataset so the get_flow description never
// enumerates a stale set (it listed the original five after twelve shipped).
const FLOW_IDS = loadFlows().map((flow) => `"${flow.id}"`).join(', ');

const PRO_MODE = isProMode();

const SERVER_INSTRUCTIONS = [
  `Provides ${PRINCIPLE_COUNT} research-backed UX/UI principles, ${SMELL_COUNT} UX smells (anti-patterns)`,
  `with fix recipes, and ${FLOW_COUNT} user-flow checklists (onboarding, forms, pricing, checkout,`,
  'navigation and more), in English and Spanish.',
  '',
  'Use search_principles / list_principles / get_principle to ground UI decisions in',
  'evidence. Use detect_smell or suggest_fix when a UI has a described problem. Use',
  'get_flow / generate_checklist before designing or shipping a known flow.',
  '',
  'All tools are read-only. get_principle carries the citations behind each principle.',
  PRO_MODE
    ? `Pro mode is on (${API_KEY_ENV} is set): get_principle returns the full guide body,`
    : `Free mode: the full guide bodies, the 600+ AI prompts, audit_interface and`,
  PRO_MODE
    ? 'get_principle_prompts returns the AI prompts, audit_interface audits a described'
    : `check_requirements need ${API_KEY_ENV} set to a Principles Library key`,
  PRO_MODE
    ? 'screen and check_requirements verifies a screen you built against the eight'
    : '(uxuiprinciples.com/en/developers). Everything else runs offline from the',
  PRO_MODE
    ? 'required-state rules, both through the uxuiprinciples.com API. Everything else stays offline.'
    : 'bundled dataset.',
  '',
  'After generating or changing a screen, call check_requirements with the flow, the',
  'components, the actions (flag the consequential and automated ones) and the states',
  'you implemented; fix every rule it reports as fail before you finish.',
].join('\n');

// Create MCP server
const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
    instructions: SERVER_INSTRUCTIONS,
  }
);

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const LOCALE_PARAM = {
  type: 'string',
  enum: ['en', 'es'],
  default: 'en',
  description: 'Language of the returned content: "en" (English) or "es" (Spanish). Defaults to "en".'
};

// Every tool is read-only and idempotent. openWorldHint marks the tools that
// reach the uxuiprinciples.com API when UXUI_API_KEY is set; the rest answer
// from the bundled dataset and never touch the network.
const OFFLINE = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const PRO_AWARE = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: PRO_MODE };

const TOOLS = [
  // Principle tools
  {
    name: 'get_principle',
    title: 'Get a principle',
    description: `Get one UX/UI principle by slug: title, code, part, difficulty, summary, the bibliographic citations behind it (author, title, year, url) and the link to the full guide on uxuiprinciples.com. With ${API_KEY_ENV} set (pro mode) the full guide body comes back in \`content\`. Use it to identify, summarize or cite a specific principle; use search_principles first when you only have a topic.`,
    annotations: PRO_AWARE,
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: {
          type: 'string',
          description: 'The principle slug as returned by search_principles or list_principles (e.g., "cognitive-load", "hicks-law", "fitts-law").'
        },
        locale: LOCALE_PARAM
      },
      required: ['slug']
    }
  },
  {
    name: 'search_principles',
    title: 'Search principles',
    description: `Search the ${PRINCIPLE_COUNT} UX/UI principles by free text, part, difficulty or tags. Returns the matching principles with slug, title, code, part name and summary, plus the total count. Use it to find which principles apply to a design question before calling get_principle.`,
    annotations: OFFLINE,
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Free-text query matched against title, slug, summary and tags (e.g., "form validation", "loading states", "choice overload").'
        },
        part: {
          type: 'string',
          description: 'Restrict to one part of the catalogue, by id or name (e.g., "part-1", "Foundations"). Call list_principles to see the parts.'
        },
        difficulty: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced'],
          description: 'Restrict to one difficulty level.'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Restrict to principles carrying every listed tag (e.g., ["forms", "errors"]).'
        },
        locale: LOCALE_PARAM,
        limit: {
          type: 'number',
          default: 10,
          description: 'Maximum number of principles to return. Defaults to 10.'
        }
      }
    }
  },
  {
    name: 'list_principles',
    title: 'List principles',
    description: `List the ${PRINCIPLE_COUNT} UX/UI principles, optionally one part at a time. Returns principle summaries (slug, title, code, part name, summary), the total count and the list of part ids. Use it to browse the catalogue or to learn the part ids for search_principles.`,
    annotations: OFFLINE,
    inputSchema: {
      type: 'object' as const,
      properties: {
        part: {
          type: 'string',
          description: 'Restrict to one part, by id or name (e.g., "part-1", "part-2"). Omit for every part.'
        },
        locale: LOCALE_PARAM,
        limit: {
          type: 'number',
          default: 20,
          description: 'Maximum number of principles to return. Defaults to 20.'
        }
      }
    }
  },
  {
    name: 'get_principle_prompts',
    title: 'Get the AI prompts of a principle',
    description: `Get the ready-to-use AI prompts attached to one principle (prompts to apply, audit or refactor an interface against it). With ${API_KEY_ENV} set (pro mode) the prompt texts come back in \`prompts\`; without it the prompts belong to the paid Principles Library and the tool returns the count and the URL of the guide. Call get_principle first if you only need the summary.`,
    annotations: PRO_AWARE,
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: {
          type: 'string',
          description: 'The principle slug (e.g., "cognitive-load").'
        },
        locale: LOCALE_PARAM
      },
      required: ['slug']
    }
  },

  // Smell tools
  {
    name: 'get_smell',
    title: 'Get a UX smell',
    description: `Get one UX smell (interface anti-pattern) by id: name, tagline, symptoms, the Nielsen heuristic it breaks, a step-by-step fix recipe with a time estimate, the related principles and an audit prompt plus a refactoring prompt. Use it once you know the smell id, from list_smells or detect_smell.`,
    annotations: OFFLINE,
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The smell id (e.g., "overloaded-screen", "form-graveyard", "silent-errors", "ai-gradient-cliche"). Call list_smells for the full set.'
        },
        locale: LOCALE_PARAM
      },
      required: ['id']
    }
  },
  {
    name: 'list_smells',
    title: 'List UX smells',
    description: `List the ${SMELL_COUNT} UX smells (interface anti-patterns such as overloaded screens, form graveyards, silent errors or the AI-aesthetic cliches), optionally filtered by category. Returns id, name, short name, tagline, category and Nielsen heuristic for each. Use it to browse the catalogue before get_smell.`,
    annotations: OFFLINE,
    inputSchema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Restrict to one category (e.g., "efficiency", "feedback", "error-prevention", "accessibility", "ai-aesthetic"). Omit for every smell.'
        },
        locale: LOCALE_PARAM
      }
    }
  },
  {
    name: 'detect_smell',
    title: 'Detect UX smells from a description',
    description: 'Detect which UX smells match a plain-language description of an interface problem or a user complaint, in English or Spanish. Returns the matched smells with a confidence level and the suggested fix for each. Use it as the first step when a UI "feels off" and the cause is not named yet; runs offline.',
    annotations: OFFLINE,
    inputSchema: {
      type: 'object' as const,
      properties: {
        description: {
          type: 'string',
          description: 'What is wrong, in the user\'s or the team\'s words (e.g., "users say the dashboard is too cluttered and they don\'t know where to start", "el formulario es demasiado largo").'
        },
        locale: LOCALE_PARAM
      },
      required: ['description']
    }
  },
  {
    name: 'suggest_fix',
    title: 'Suggest a fix for a UX issue',
    description: 'Get a fix for a described UX issue: detects the most likely smell (or uses the one you pass), then returns its step-by-step fix recipe, the principles to apply and a refactoring prompt you can hand to a coding agent. Use it when you want an actionable remedy rather than a diagnosis; runs offline.',
    annotations: OFFLINE,
    inputSchema: {
      type: 'object' as const,
      properties: {
        issue: {
          type: 'string',
          description: 'The UX issue to fix, in plain language (e.g., "the checkout asks for account creation before showing the price").'
        },
        smell_id: {
          type: 'string',
          description: 'Optional smell id to skip detection when the smell is already known (e.g., "dead-end-states").'
        },
        locale: LOCALE_PARAM
      },
      required: ['issue']
    }
  },

  // Flow tools
  {
    name: 'get_flow',
    title: 'Get a user flow',
    description: 'Get one user flow (onboarding, forms, pricing, dashboard, checkout, search, authentication and more) with its target metrics, the pre-flight checklist to run before designing it and the post-flight checklist to run before shipping it. Use it before designing or shipping a known flow.',
    annotations: OFFLINE,
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: `The flow id. One of: ${FLOW_IDS}. Call list_flows for the current set.`
        },
        locale: LOCALE_PARAM
      },
      required: ['id']
    }
  },
  {
    name: 'list_flows',
    title: 'List user flows',
    description: `List the ${FLOW_COUNT} user flows covered by the checklists (onboarding, forms, pricing, dashboard, empty states, checkout, settings, navigation, search, authentication, notifications, data tables) with the target metric of each. Returns id, name, description, metric target and the number of checklist items per phase. Use it to pick the id for get_flow, generate_checklist or get_flow_principles.`,
    annotations: OFFLINE,
    inputSchema: {
      type: 'object' as const,
      properties: {
        locale: LOCALE_PARAM
      }
    }
  },
  {
    name: 'generate_checklist',
    title: 'Generate a flow checklist',
    description: 'Generate the pre-flight (before design) or post-flight (before ship) checklist for one user flow. Returns the checklist as structured items (each tied to a principle) and as ready-to-paste markdown. Use it to review a design or a pull request against the flow it implements.',
    annotations: OFFLINE,
    inputSchema: {
      type: 'object' as const,
      properties: {
        flow_id: {
          type: 'string',
          description: `The flow id. One of: ${FLOW_IDS}. Call list_flows for the current set.`
        },
        phase: {
          type: 'string',
          enum: ['preflight', 'postflight'],
          description: 'Which checklist to generate: "preflight" (before design) or "postflight" (before ship).'
        },
        locale: LOCALE_PARAM
      },
      required: ['flow_id', 'phase']
    }
  },
  {
    name: 'get_flow_principles',
    title: 'Get the principles behind a flow',
    description: 'Get the key principles that govern one user flow and the UX smells that most often break it. Returns the principle slugs and the smell ids so you can read them with get_principle and get_smell. Use it to ground a flow review in evidence.',
    annotations: OFFLINE,
    inputSchema: {
      type: 'object' as const,
      properties: {
        flow_id: {
          type: 'string',
          description: `The flow id. One of: ${FLOW_IDS}.`
        },
        locale: LOCALE_PARAM
      },
      required: ['flow_id']
    }
  },

  // Pro tools (uxuiprinciples.com API, need UXUI_API_KEY)
  {
    name: 'audit_interface',
    title: 'Audit an interface',
    description: `Audit a described screen or flow: returns findings mapped to principles and UX smells, each with severity, remediation and business impact, plus a score, the detected interface type, strengths and the three priority fixes. Pro mode only (${API_KEY_ENV} set): the audit runs on the uxuiprinciples.com API. Without a key use detect_smell then suggest_fix, which run offline.`,
    annotations: PRO_AWARE,
    inputSchema: {
      type: 'object' as const,
      properties: {
        description: {
          type: 'string',
          description: `What the screen shows and what users do or complain about, ${AUDIT_MIN_CHARS} to ${AUDIT_MAX_CHARS} characters. Name the components, the actions and the states you implemented (loading, empty, error, confirmation).`
        },
        locale: {
          ...LOCALE_PARAM,
          description: 'Language of the findings: "en" or "es". Defaults to "en".'
        },
        context: {
          type: 'string',
          enum: ['figma', 'web', 'mobile', 'email'],
          description: 'Where the interface lives. Echoed in the result; does not change the rules.'
        },
        depth: {
          type: 'string',
          enum: ['quick', 'full'],
          default: 'full',
          description: '"quick": the top 5 findings. "full": every finding. Defaults to "full".'
        }
      },
      required: ['description']
    }
  },
  {
    name: 'check_requirements',
    title: 'Check a screen against the required-state rules',
    description: `Check a screen you built or designed against eight experience requirements: confirmation before consequential actions, error state, empty state, loading state, undo or edit, sources on AI output, recovery after an AI error, consent before automation. Describe the screen as data (flow, components, actions with flags, states implemented) and get pass, fail or not_applicable per rule, each with the principle it comes from and its citations, plus a markdown summary. Call it after generating or changing a screen and fix every fail. Pro mode only (${API_KEY_ENV} set); without a key use generate_checklist for the unevaluated checklist.`,
    annotations: PRO_AWARE,
    inputSchema: {
      type: 'object' as const,
      properties: {
        flow: {
          type: 'string',
          description: `The flow the screen belongs to. One of: ${FLOW_IDS}. Other values are accepted and match no flow rule.`
        },
        components: {
          type: 'array',
          items: { type: 'string' },
          description: 'What is on the screen, one item per component, in plain words (e.g., "search input", "results table", "AI summary panel"). Words such as form, table, list, search, chart, AI, chat or summary decide which rules apply.'
        },
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'What the action does (e.g., "Delete project").' },
              consequential: { type: 'boolean', description: 'True when it deletes, sends, pays, publishes or changes something the user cannot trivially get back.' },
              automated: { type: 'boolean', description: 'True when it runs on the user\'s behalf, in the background, or uses their data to train or personalize.' }
            },
            required: ['label']
          },
          description: 'The actions the screen offers, with their flags.'
        },
        states_implemented: {
          type: 'array',
          items: { type: 'string', enum: [...CHECK_STATES] },
          description: 'The states the implementation has: loading, empty, error, success, confirmation, undo, edit, sources, recovery, consent. Only list what is built.'
        },
        locale: {
          ...LOCALE_PARAM,
          description: 'Language of the verdicts and the summary: "en" or "es". Defaults to "en".'
        }
      }
    }
  }
];

// =============================================================================
// INPUT VALIDATION
// =============================================================================

// Runtime validation for tool arguments (project convention: validate at
// boundaries with Zod). The low-level MCP Server does not enforce inputSchema,
// so without this a missing required field reaches the tool as `undefined`.
const localeSchema = z.enum(['en', 'es']).optional();
const nonEmpty = (field: string) => z.string().min(1, `${field} is required`);

const TOOL_SCHEMAS: Record<string, z.ZodType> = {
  get_principle: z.object({ slug: nonEmpty('slug'), locale: localeSchema }),
  search_principles: z.object({
    query: z.string().optional(),
    part: z.string().optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    tags: z.array(z.string()).optional(),
    locale: localeSchema,
    limit: z.number().optional(),
  }),
  list_principles: z.object({ part: z.string().optional(), locale: localeSchema, limit: z.number().optional() }),
  get_principle_prompts: z.object({ slug: nonEmpty('slug'), locale: localeSchema }),
  get_smell: z.object({ id: nonEmpty('id'), locale: localeSchema }),
  list_smells: z.object({ category: z.string().optional(), locale: localeSchema }),
  detect_smell: z.object({ description: nonEmpty('description'), locale: localeSchema }),
  suggest_fix: z.object({ issue: nonEmpty('issue'), smell_id: z.string().optional(), locale: localeSchema }),
  get_flow: z.object({ id: nonEmpty('id'), locale: localeSchema }),
  list_flows: z.object({ locale: localeSchema }),
  generate_checklist: z.object({
    flow_id: nonEmpty('flow_id'),
    phase: z.enum(['preflight', 'postflight']),
    locale: localeSchema,
  }),
  get_flow_principles: z.object({ flow_id: nonEmpty('flow_id'), locale: localeSchema }),
  audit_interface: z.object({
    description: z
      .string()
      .min(AUDIT_MIN_CHARS, `description needs at least ${AUDIT_MIN_CHARS} characters`)
      .max(AUDIT_MAX_CHARS, `description is capped at ${AUDIT_MAX_CHARS} characters`),
    locale: localeSchema,
    context: z.enum(['figma', 'web', 'mobile', 'email']).optional(),
    depth: z.enum(['quick', 'full']).optional(),
  }),
  check_requirements: z.object({
    flow: z.string().min(1).max(60).optional(),
    components: z.array(z.string().min(1).max(80)).max(60).optional(),
    actions: z
      .array(
        z.object({
          label: z.string().min(1).max(120),
          consequential: z.boolean().optional(),
          automated: z.boolean().optional(),
        })
      )
      .max(60)
      .optional(),
    states_implemented: z.array(z.enum(CHECK_STATES)).max(CHECK_STATES.length).optional(),
    locale: localeSchema,
  }),
};

// =============================================================================
// REQUEST HANDLERS
// =============================================================================

// List available tools. Titles and annotations are declared per tool above.
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Validate arguments against the tool's schema before dispatch.
  const schema = TOOL_SCHEMAS[name];
  if (schema) {
    const parsed = schema.safeParse(args ?? {});
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      return {
        content: [{ type: 'text', text: `Invalid arguments for ${name}: ${detail}` }],
        isError: true,
      };
    }
  }

  try {
    let result: unknown;

    switch (name) {
      // Principle tools
      case 'get_principle':
        result = await getPrincipleTool(args?.slug as string, args?.locale as 'en' | 'es');
        break;

      case 'search_principles':
        result = searchPrinciplesTool(
          args?.query as string | undefined,
          args?.part as string | undefined,
          args?.difficulty as 'beginner' | 'intermediate' | 'advanced' | undefined,
          args?.tags as string[] | undefined,
          args?.locale as 'en' | 'es' | undefined,
          args?.limit as number | undefined
        );
        break;

      case 'list_principles':
        result = listPrinciplesTool(
          args?.part as string | undefined,
          args?.locale as 'en' | 'es' | undefined,
          args?.limit as number | undefined
        );
        break;

      case 'get_principle_prompts':
        result = await getPrinciplePromptsTool(
          args?.slug as string,
          args?.locale as 'en' | 'es' | undefined
        );
        break;

      // Smell tools
      case 'get_smell':
        result = getSmellTool(args?.id as string, args?.locale as 'en' | 'es');
        break;

      case 'list_smells':
        result = listSmellsTool(
          args?.category as string | undefined,
          args?.locale as 'en' | 'es' | undefined
        );
        break;

      case 'detect_smell':
        result = detectSmellTool(
          args?.description as string,
          args?.locale as 'en' | 'es' | undefined
        );
        break;

      case 'suggest_fix':
        result = suggestFixTool(
          args?.issue as string,
          args?.smell_id as string | undefined,
          args?.locale as 'en' | 'es' | undefined
        );
        break;

      // Flow tools
      case 'get_flow':
        result = getFlowTool(args?.id as string, args?.locale as 'en' | 'es');
        break;

      case 'list_flows':
        result = listFlowsTool(args?.locale as 'en' | 'es' | undefined);
        break;

      case 'generate_checklist':
        result = generateChecklistTool(
          args?.flow_id as string,
          args?.phase as 'preflight' | 'postflight',
          args?.locale as 'en' | 'es' | undefined
        );
        break;

      case 'get_flow_principles':
        result = getFlowPrinciplesTool(
          args?.flow_id as string,
          args?.locale as 'en' | 'es' | undefined
        );
        break;

      // Pro tools
      case 'audit_interface':
        result = await auditInterfaceTool(
          args?.description as string,
          args?.locale as 'en' | 'es' | undefined,
          args?.context as 'figma' | 'web' | 'mobile' | 'email' | undefined,
          args?.depth as 'quick' | 'full' | undefined
        );
        break;

      case 'check_requirements':
        result = await checkRequirementsTool((args ?? {}) as CheckInput);
        break;

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}. Available tools: ${TOOLS.map(t => t.name).join(', ')}`
            }
          ],
          isError: true
        };
    }

    // Surface per-tool failures ({ success: false }) as MCP errors, not plain results.
    const isError =
      typeof result === 'object' && result !== null && (result as { success?: boolean }).success === false;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ],
      ...(isError ? { isError: true } : {})
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing tool ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ],
      isError: true
    };
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // The key itself is never printed; only whether one is set.
  console.error(`${SERVER_NAME} MCP server v${SERVER_VERSION} running on stdio (${PRO_MODE ? `pro mode, ${API_KEY_ENV} set` : 'free mode'})`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
