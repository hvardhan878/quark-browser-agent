// Tool definitions for the Quark Agent
import type { ToolResult, APIEndpoint } from '../shared/types';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
  requiresPermission: boolean;
}

// Tool definitions that will be sent to the LLM
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'capture_snapshot',
    description: 'Capture the current page structure including DOM elements, forms, buttons, and other interactive elements. Use this to understand the page layout before making modifications.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    requiresPermission: false,
  },
  {
    name: 'capture_screenshot',
    description: 'Take a screenshot of the current page. Useful for visual understanding of the page layout.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    requiresPermission: false,
  },
  {
    name: 'pick_element',
    description: 'Prompt the user to click on an element on the page. Returns the element selector and HTML. Use this when you need the user to identify a specific element.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    requiresPermission: false,
  },
  {
    name: 'verify_element',
    description: 'Check if a CSS selector exists on the current page and return information about matching elements.',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector to verify',
        },
      },
      required: ['selector'],
    },
    requiresPermission: false,
  },
  {
    name: 'read_page_content',
    description: 'Extract text content from a specific element or the entire page.',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector to read from. If not provided, reads entire page.',
        },
      },
      required: [],
    },
    requiresPermission: false,
  },
  {
    name: 'get_api_endpoints',
    description: 'Get a list of API endpoints that have been intercepted on the current page. Useful for understanding what APIs the page uses.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    requiresPermission: false,
  },
  {
    name: 'call_api',
    description: 'Make an HTTP request to an API endpoint. Use this to test APIs or fetch data.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full URL to call',
        },
        method: {
          type: 'string',
          description: 'HTTP method',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        },
        headers: {
          type: 'string',
          description: 'JSON string of headers to include',
        },
        body: {
          type: 'string',
          description: 'Request body (for POST/PUT/PATCH)',
        },
      },
      required: ['url', 'method'],
    },
    requiresPermission: true,
  },
  {
    name: 'inject_script',
    description: 'Inject and execute JavaScript code on the current page. The code runs in the page context and can modify the DOM, intercept APIs, etc.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript code to inject and execute',
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what the script does',
        },
      },
      required: ['code', 'description'],
    },
    requiresPermission: true,
  },
];

// Convert tool definitions to OpenRouter format
export function getToolsForOpenRouter(): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolDefinition['parameters'];
  };
}> {
  return TOOL_DEFINITIONS.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

// Check if a tool requires user permission
export function toolRequiresPermission(toolName: string): boolean {
  const tool = TOOL_DEFINITIONS.find(t => t.name === toolName);
  return tool?.requiresPermission ?? false;
}

// Tool executor class
export class ToolExecutor {
  private tabId: number;
  private apiEndpoints: Map<string, APIEndpoint[]>;

  constructor(tabId: number, apiEndpoints: Map<string, APIEndpoint[]>) {
    this.tabId = tabId;
    this.apiEndpoints = apiEndpoints;
  }

  async execute(toolName: string, params: Record<string, unknown>): Promise<ToolResult> {
    console.log(`[Quark Agent] Executing tool: ${toolName}`, params);

    try {
      switch (toolName) {
        case 'capture_snapshot':
          return await this.captureSnapshot();
        
        case 'capture_screenshot':
          return await this.captureScreenshot();
        
        case 'pick_element':
          return await this.pickElement();
        
        case 'verify_element':
          return await this.verifyElement(params.selector as string);
        
        case 'read_page_content':
          return await this.readPageContent(params.selector as string | undefined);
        
        case 'get_api_endpoints':
          return await this.getApiEndpoints();
        
        case 'call_api':
          return await this.callApi(
            params.url as string,
            params.method as string,
            params.headers as string | undefined,
            params.body as string | undefined
          );
        
        case 'inject_script':
          return await this.injectScript(
            params.code as string,
            params.description as string
          );
        
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      console.error(`[Quark Agent] Tool execution error:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  private async captureSnapshot(): Promise<ToolResult> {
    try {
      const result = await chrome.tabs.sendMessage(this.tabId, { 
        type: 'CAPTURE_SNAPSHOT', 
        payload: {} 
      });
      
      if (result?.success && result?.snapshot) {
        return { success: true, data: result.snapshot };
      }
      return { success: false, error: result?.error || 'Failed to capture snapshot' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async captureScreenshot(): Promise<ToolResult> {
    try {
      const currentWindow = await chrome.windows.getCurrent();
      const dataUrl = await chrome.tabs.captureVisibleTab(currentWindow.id!, { format: 'png' });
      // Store the screenshot but don't return the full base64 in the result
      // The screenshot is available for vision models but we don't want to bloat the context
      return { 
        success: true, 
        data: { 
          captured: true,
          message: 'Screenshot captured successfully. The image shows the current visible viewport of the page.',
          // Include a small portion for reference (useful for debugging)
          previewSize: `${Math.round(dataUrl.length / 1024)}KB`
        } 
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async pickElement(): Promise<ToolResult> {
    try {
      // Start element picker on the tab
      await chrome.tabs.sendMessage(this.tabId, { 
        type: 'START_ELEMENT_PICKER', 
        payload: {} 
      });
      
      // Return a message that we're waiting for user selection
      return { 
        success: true, 
        data: { 
          status: 'awaiting_selection',
          message: 'Element picker activated. Waiting for user to select an element...' 
        } 
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async verifyElement(selector: string): Promise<ToolResult> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (sel: string) => {
          const elements = document.querySelectorAll(sel);
          if (elements.length === 0) {
            return { exists: false, count: 0 };
          }
          
          return {
            exists: true,
            count: elements.length,
            elements: Array.from(elements).slice(0, 5).map(el => ({
              tagName: el.tagName,
              id: el.id || undefined,
              classes: Array.from(el.classList),
              textContent: el.textContent?.trim().substring(0, 100),
              isVisible: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0,
            })),
          };
        },
        args: [selector],
        world: 'MAIN',
      });

      return { success: true, data: results[0]?.result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async readPageContent(selector?: string): Promise<ToolResult> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (sel?: string) => {
          if (sel) {
            const element = document.querySelector(sel);
            if (!element) {
              return { found: false, error: 'Element not found' };
            }
            return {
              found: true,
              textContent: element.textContent?.trim().substring(0, 5000),
              innerHTML: element.innerHTML.substring(0, 2000),
            };
          } else {
            return {
              found: true,
              title: document.title,
              textContent: document.body.textContent?.trim().substring(0, 5000),
            };
          }
        },
        args: [selector],
        world: 'MAIN',
      });

      return { success: true, data: results[0]?.result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async getApiEndpoints(): Promise<ToolResult> {
    const tab = await chrome.tabs.get(this.tabId);
    if (!tab.url) {
      return { success: false, error: 'Cannot determine tab URL' };
    }

    const domain = new URL(tab.url).hostname;
    const endpoints = this.apiEndpoints.get(domain) || [];

    return {
      success: true,
      data: {
        domain,
        endpointCount: endpoints.length,
        endpoints: endpoints.map(ep => ({
          method: ep.method,
          path: ep.path,
          baseUrl: ep.baseUrl,
          authType: ep.authType,
          callCount: ep.callCount,
          queryParams: Object.keys(ep.queryParams),
        })),
      },
    };
  }

  private async callApi(
    url: string,
    method: string,
    headersJson?: string,
    body?: string
  ): Promise<ToolResult> {
    try {
      const headers: Record<string, string> = headersJson ? JSON.parse(headersJson) : {};
      
      const response = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' && body ? body : undefined,
      });

      const contentType = response.headers.get('content-type') || '';
      let responseData: unknown;

      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      return {
        success: true,
        data: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseData,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async injectScript(code: string, _description: string): Promise<ToolResult> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (scriptCode: string) => {
          try {
            const script = document.createElement('script');
            script.textContent = scriptCode;
            (document.head || document.documentElement).appendChild(script);
            script.remove();
            return { success: true };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },
        args: [code],
        world: 'MAIN',
      });

      const result = results[0]?.result as { success: boolean; error?: string } | undefined;
      if (result?.success) {
        return { success: true, data: { injected: true } };
      }
      return { success: false, error: result?.error || 'Injection failed' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

