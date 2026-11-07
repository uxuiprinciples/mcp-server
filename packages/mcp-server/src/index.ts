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
    : `Free mode: the full guide bodies, the 600+ AI prompts and audit_interface need`,
  PRO_MODE
    ? 'get_principle_prompts returns the AI prompts, and audit_interface audits a described'
    : `${API_KEY_ENV} set to a Principles Library key (uxuiprinciples.com/en/developers).`,
  PRO_MODE
    ? 'screen through the uxuiprinciples.com API. Everything else stays offline.'
    : 'Everything else runs offline from the bundled dataset.',
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

const TOOLS = [
  // Principle tools
  {
    name: 'get_principle',
    description: `Get a UX/UI principle by its slug: metadata, summary, the bibliographic citations behind it (author, title, year, url) and a link to the full research-backed guide on uxuiprinciples.com. With ${API_KEY_ENV} set (pro mode) the full guide body comes back in \`content\`. Use this to identify, summarize or cite a specific principle.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: {
          type: 'string',
          description: 'The principle slug (e.g., "cognitive-load", "hicks-law", "fitts-law")'
        },
        locale: {
          type: 'string',
          enum: ['en', 'es'],
          default: 'en',
          description: 'Language for the content'
        }
      },
      required: ['slug']
    }
  },
  {
    name: 'search_principles',
    description: 'Search UX/UI principles by query, part, difficulty, or tags. Returns matching principles with summaries.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (searches title, slug, summary, and tags)'
        },
        part: {
          type: 'string',
          description: 'Filter by part (e.g., "part-1", "Foundations")'
        },
        difficulty: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced'],
          description: 'Filter by difficulty level'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags'
        },
        locale: {
          type: 'string',
          enum: ['en', 'es'],
          default: 'en'
        },
        limit: {
          type: 'number',
          default: 10,
          description: 'Maximum results to return'
        }
      }
    }
  },
  {
    name: 'list_principles',
    description: 'List all UX/UI principles or filter by part. Returns principle summaries and available parts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        part: {
          type: 'string',
          description: 'Filter by part name or ID'
        },
        locale: {
          type: 'string',
          enum: ['en', 'es'],
          default: 'en'
        },
        limit: {
          type: 'number',
          default: 20
        }
      }
    }
  },
  {
    name: 'get_principle_prompts',
    description: `Get the AI prompts for a specific principle. With ${API_KEY_ENV} set (pro mode) the prompt texts come back in \`prompts\`; without it the prompts belong to the paid Principles Library and the tool returns the URL of the guide. Call get_principle first if you only need the summary.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: {
          type: 'string',
          description: 'The principle slug'
        },
        locale: {
          type: 'string',
          enum: ['en', 'es'],
          default: 'en'
        }
      },
      required: ['slug']
    }
  },

  // Smell tools
  {
    name: 'get_smell',
    description: 'Get a UX smell (anti-pattern) by ID with symptoms, fix recipe, and related prompts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The smell ID (e.g., "overloaded-screen", "form-graveyard")'
        },
        locale: {
          type: 'string',
          enum: ['en', 'es'],
          default: 'en'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'list_smells',
    description: 'List all UX smells (anti-patterns) optionally filtered by category.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category (e.g., "efficiency", "usability")'
        },
        locale: {
          type: 'string',
          enum: ['en', 'es'],
          default: 'en'
        }
      }
    }
  },
  {
    name: 'detect_smell',
    description: 'Detect potential UX smells based on a description of UI issues. Returns matched smells with confidence levels and suggested fixes.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        description: {
          type: 'string',
          description: 'Description of the UI issue or user complaint (e.g., "users say the dashboard is too cluttered and they don\'t know where to start")'
        },
        locale: {
          type: 'string',
          enum: ['en', 'es'],
          default: 'en'
        }
      },
      required: ['description']
    }
  },
  {
    name: 'suggest_fix',
    description: 'Get a fix suggestion for a UX issue. Detects the smell and provides step-by-step fix recipe with a refactoring prompt.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        issue: {
          type: 'string',
          description: 'Description of the UX issue to fix'
        },
        smell_id: {
          type: 'string',
          description: 'Optional: specific smell ID if already known'
        },
        locale: {
          type: 'string',
          enum: ['en', 'es'],
          default: 'en'
        }
      },
      required: ['issue']
    }
  },

  // Flow tools
  {
    name: 'get_flow',
    description: 'Get a user flow with pre-flight and post-flight checklists. Use before designing or shipping a flow.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: `The flow ID. One of: ${FLOW_IDS}. Call list_flows for the current set.`
        },
        locale: {
          type: 'string',
          enum: ['en', 'es'],
          default: 'en'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'list_flows',
    description: 'List all available user flows with their target metrics.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        locale: {
          type: 'string',
          enum: ['en', 'es'],
          default: 'en'
        }
      }
    }
  },
  {
    name: 'generate_checklist',
    description: 'Generate a pre-flight or post-flight checklist for a specific flow. Returns both structured data and markdown.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        flow_id: {
          type: 'string',
          description: 'The flow ID'
        },
        phase: {
          type: 'string',
          enum: ['preflight', 'postflight'],
          description: 'Which checklist to generate: preflight (before design) or postflight (before ship)'
        },
        locale: {
          type: 'string',
          enum: ['en', 'es'],
          default: 'en'
        }
      },
      required: ['flow_id', 'phase']
    }
  },
  {
    name: 'get_flow_principles',
    description: 'Get the key principles and common smells for a specific flow.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        flow_id: {
          type: 'string',
          description: `The flow ID. One of: ${FLOW_IDS}.`
        },
        locale: {
          type: 'string',
          enum: ['en', 'es'],
          default: 'en'
        }
      },
      required: ['flow_id']
    }
  },

  // Pro tools (uxuiprinciples.com API, need UXUI_API_KEY)
  {
    name: 'audit_interface',
    description: `Audit a described screen or flow: returns findings mapped to principles and UX smells, each with severity, remediation and business impact, plus a score, the detected interface type, strengths and the three priority fixes. Pro mode only (${API_KEY_ENV} set): the audit runs on the uxuiprinciples.com API. Without a key use detect_smell then suggest_fix, which run offline.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        description: {
          type: 'string',
          description: `What the screen shows and what users do or complain about, ${AUDIT_MIN_CHARS} to ${AUDIT_MAX_CHARS} characters. Name the components, the actions and the states you implemented (loading, empty, error, confirmation).`
        },
        locale: {
          type: 'string',
          enum: ['en', 'es'],
          default: 'en',
          description: 'Language of the findings'
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
          description: 'quick: top 5 findings. full: every finding.'
        }
      },
      required: ['description']
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
};

// =============================================================================
// REQUEST HANDLERS
// =============================================================================

// List available tools. Every tool is read-only (no side effects).
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(tool => ({ ...tool, annotations: { readOnlyHint: true } }))
}));

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
