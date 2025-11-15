#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { ChromeBridge } from './chrome-bridge.js';
import { mapPageTool } from './tools/map.js';
import { planFillTool } from './tools/plan.js';
import { executeFillTool } from './tools/execute.js';

const SERVER_NAME = 'anchor-mcp-server';
const SERVER_VERSION = '1.0.0';

class AnchorMCPServer {
  private server: Server;
  private chromeBridge: ChromeBridge;

  constructor() {
    this.server = new Server(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.chromeBridge = new ChromeBridge({
      port: 9222,
      extensionCheckInterval: 1000,
    });

    this.setupToolHandlers();
    this.setupErrorHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'anchor_map_page',
            description: 'Map the current EMR page to extract PHI-safe field structure. Returns field graph with selectors, labels, types, and positions.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'URL of the EMR page to map (optional - uses current tab if not provided)',
                },
                includeHidden: {
                  type: 'boolean',
                  description: 'Include hidden fields in the map (default: false)',
                },
              },
            },
          },
          {
            name: 'anchor_plan_fill',
            description: 'Generate a fill plan by matching clinical note sections to EMR fields. Analyzes note structure (SOAP/APSO) and scores field matches.',
            inputSchema: {
              type: 'object',
              properties: {
                note: {
                  type: 'string',
                  description: 'Clinical note text (SOAP or APSO format)',
                },
                url: {
                  type: 'string',
                  description: 'URL of the target page (uses last mapped page if not provided)',
                },
                targetNoteField: {
                  type: 'string',
                  description: 'Optional specific field label to target (e.g. "Progress Note")',
                },
              },
              required: ['note'],
            },
          },
          {
            name: 'anchor_execute_fill',
            description: 'Execute a fill plan on the EMR page. Inserts text into fields, triggers events, and provides visual confirmation via Ghost overlay.',
            inputSchema: {
              type: 'object',
              properties: {
                plan: {
                  type: 'object',
                  description: 'Fill plan object from anchor_plan_fill',
                },
                preview: {
                  type: 'boolean',
                  description: 'Show preview without executing (default: false)',
                },
                url: {
                  type: 'string',
                  description: 'URL of the target page',
                },
              },
              required: ['plan'],
            },
          },
        ] satisfies Tool[],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'anchor_map_page':
            return await mapPageTool(this.chromeBridge, args);

          case 'anchor_plan_fill':
            return await planFillTool(this.chromeBridge, args);

          case 'anchor_execute_fill':
            return await executeFillTool(this.chromeBridge, args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupErrorHandlers() {
    this.server.onerror = (error) => {
      console.error('[MCP Server] Error:', error);
    };

    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private async cleanup() {
    console.error('[MCP Server] Shutting down...');
    await this.chromeBridge.disconnect();
    await this.server.close();
  }

  async run() {
    console.error('[MCP Server] Starting Anchor MCP Server...');
    console.error(`[MCP Server] Version: ${SERVER_VERSION}`);
    console.error('[MCP Server] Connecting to Chrome on port 9222...');

    // Connect to Chrome
    await this.chromeBridge.connect();

    console.error('[MCP Server] Chrome connected successfully');
    console.error('[MCP Server] Checking for Anchor extension...');

    // Wait for extension to be ready
    const extensionReady = await this.chromeBridge.waitForExtension(10000);

    if (!extensionReady) {
      console.error('[MCP Server] WARNING: Anchor extension not detected');
      console.error('[MCP Server] Extension may need to be loaded manually');
    } else {
      console.error('[MCP Server] Anchor extension detected and ready');
    }

    // Start stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('[MCP Server] Ready to accept tool calls via stdio');
  }
}

// Start server
const server = new AnchorMCPServer();
server.run().catch((error) => {
  console.error('[MCP Server] Fatal error:', error);
  process.exit(1);
});
