// Quark Agent - Agentic loop for autonomous tool use
import type { 
  AgentState, 
  AgentTask, 
  AgentMessage, 
  ToolCall, 
  OpenRouterConfig,
  GeneratedScript,
  PermissionRequest,
  APIEndpoint,
} from '../shared/types';
import { generateId } from '../shared/messaging';
import { ToolExecutor, getToolsForOpenRouter, toolRequiresPermission, TOOL_DEFINITIONS } from './tools';
import { getConfig, saveScript } from '../shared/storage';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// In-memory store for active agents
const activeAgents = new Map<string, AgentState>();
const pendingPermissions = new Map<string, PermissionRequest>();
const permissionResolvers = new Map<string, (approved: boolean) => void>();

// Callbacks for state updates (set by background script)
let stateUpdateCallback: ((state: AgentState) => void) | null = null;
let permissionRequestCallback: ((request: PermissionRequest) => void) | null = null;

export function setStateUpdateCallback(callback: (state: AgentState) => void): void {
  stateUpdateCallback = callback;
}

export function setPermissionRequestCallback(callback: (request: PermissionRequest) => void): void {
  permissionRequestCallback = callback;
}

// Get current agent state
export function getAgentState(agentId: string): AgentState | undefined {
  return activeAgents.get(agentId);
}

// Get all active agents
export function getActiveAgents(): AgentState[] {
  return Array.from(activeAgents.values());
}

// System prompt for the agent
function buildAgentSystemPrompt(domain: string, activeScript?: GeneratedScript): string {
  let prompt = `You are Quark, an AI agent that helps users customize and modify websites. You have access to tools that let you inspect, understand, and modify web pages.

Your capabilities:
- Capture and analyze page structure (capture_snapshot)
- Take screenshots for visual understanding (capture_screenshot)
- Let users point to specific elements (pick_element)
- Verify if CSS selectors exist (verify_element)
- Read page content (read_page_content)
- View intercepted API endpoints (get_api_endpoints)
- Make API calls to test endpoints (call_api)
- Inject JavaScript to modify the page (inject_script)

Guidelines:
1. Before modifying a page, always capture a snapshot first to understand its structure
2. Use verify_element to check if your selectors exist before injecting scripts
3. When you need to target a specific element the user mentions, ask them to pick it
4. For inject_script, always provide clear JavaScript with error handling
5. If a tool call fails, try an alternative approach
6. Ask for permission before running inject_script (it will automatically request)

Current website: ${domain}`;

  if (activeScript) {
    prompt += `

You are currently editing an existing script:
Name: ${activeScript.name}
Description: ${activeScript.description}
Original prompt: ${activeScript.prompt}

Current code:
\`\`\`javascript
${activeScript.code}
\`\`\`

The user wants to modify this script. Use the existing code as a starting point.`;
  }

  prompt += `

When generating JavaScript code:
- Write self-contained code that handles errors
- Use modern ES6+ syntax
- Add comments explaining what the code does
- Use fallback selectors when possible
- Consider dynamic content (use MutationObserver if needed)

Respond conversationally but stay focused on the task.`;

  return prompt;
}

// Create a new agent session
export function createAgent(
  domain: string, 
  tabId: number, 
  activeScript?: GeneratedScript
): AgentState {
  const agent: AgentState = {
    id: generateId(),
    domain,
    tabId,
    status: 'idle',
    tasks: [],
    messages: [],
    activeScriptId: activeScript?.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Add system message
  agent.messages.push({
    id: generateId(),
    role: 'system',
    content: buildAgentSystemPrompt(domain, activeScript),
    timestamp: Date.now(),
  });

  activeAgents.set(agent.id, agent);
  return agent;
}

// Add a task to the agent
function addTask(agent: AgentState, description: string, toolName?: string): AgentTask {
  const task: AgentTask = {
    id: generateId(),
    description,
    status: 'pending',
    toolName,
    timestamp: Date.now(),
  };
  agent.tasks.push(task);
  agent.updatedAt = Date.now();
  notifyStateUpdate(agent);
  return task;
}

// Update task status
function updateTaskStatus(
  agent: AgentState, 
  taskId: string, 
  status: AgentTask['status'],
  result?: unknown,
  error?: string
): void {
  const task = agent.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = status;
    if (result !== undefined) task.result = result;
    if (error !== undefined) task.error = error;
  }
  agent.updatedAt = Date.now();
  notifyStateUpdate(agent);
}

// Notify state update
function notifyStateUpdate(agent: AgentState): void {
  if (stateUpdateCallback) {
    stateUpdateCallback(agent);
  }
}

// Request permission for sensitive actions
async function requestPermission(
  agent: AgentState,
  toolName: string,
  toolParams: Record<string, unknown>,
  description: string
): Promise<boolean> {
  const request: PermissionRequest = {
    id: generateId(),
    agentId: agent.id,
    toolName,
    toolParams,
    description,
    timestamp: Date.now(),
  };

  pendingPermissions.set(request.id, request);
  
  // Notify UI about permission request
  if (permissionRequestCallback) {
    permissionRequestCallback(request);
  }

  // Wait for user response
  return new Promise((resolve) => {
    permissionResolvers.set(request.id, resolve);
    
    // Auto-reject after 5 minutes
    setTimeout(() => {
      if (permissionResolvers.has(request.id)) {
        permissionResolvers.delete(request.id);
        pendingPermissions.delete(request.id);
        resolve(false);
      }
    }, 300000);
  });
}

// Handle permission response from user
export function handlePermissionResponse(requestId: string, approved: boolean): void {
  const resolver = permissionResolvers.get(requestId);
  if (resolver) {
    resolver(approved);
    permissionResolvers.delete(requestId);
    pendingPermissions.delete(requestId);
  }
}

// Call OpenRouter with tool support
async function callOpenRouter(
  config: OpenRouterConfig,
  messages: Array<{ role: string; content: string; tool_calls?: unknown; tool_call_id?: string }>,
  tools: ReturnType<typeof getToolsForOpenRouter>
): Promise<{
  content?: string;
  toolCalls?: ToolCall[];
  error?: string;
}> {
  try {
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'chrome-extension://quark-browser-agent',
        'X-Title': 'Quark Browser Agent',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        error: `API Error: ${response.status} - ${errorData.error?.message ?? response.statusText}` 
      };
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      return { error: 'No response from AI' };
    }

    const message = choice.message;
    
    // Check for tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCalls: ToolCall[] = message.tool_calls.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || '{}'),
      }));
      return { toolCalls, content: message.content };
    }

    return { content: message.content };
  } catch (error) {
    return { error: `Request failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Main agent loop
export async function runAgent(
  agentId: string,
  userMessage: string,
  apiEndpoints: Map<string, APIEndpoint[]>,
  activeScript?: GeneratedScript
): Promise<void> {
  const agent = activeAgents.get(agentId);
  if (!agent) {
    console.error(`[Quark Agent] Agent not found: ${agentId}`);
    return;
  }

  const config = await getConfig();
  if (!config.apiKey) {
    agent.status = 'error';
    agent.error = 'OpenRouter API key not configured';
    notifyStateUpdate(agent);
    return;
  }

  // Update agent status
  agent.status = 'running';
  notifyStateUpdate(agent);

  // Add user message
  const userMsg: AgentMessage = {
    id: generateId(),
    role: 'user',
    content: userMessage,
    timestamp: Date.now(),
  };
  agent.messages.push(userMsg);
  notifyStateUpdate(agent);

  // Create tool executor
  const toolExecutor = new ToolExecutor(agent.tabId, apiEndpoints);
  const tools = getToolsForOpenRouter();

  // Prepare messages for API
  const apiMessages = agent.messages.map(m => {
    if (m.role === 'tool') {
      return {
        role: 'tool' as const,
        content: m.content,
        tool_call_id: m.toolCallId,
      };
    }
    if (m.toolCalls) {
      return {
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content || '',
        tool_calls: m.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };
    }
    return {
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    };
  });

  // Agent loop - continue until we get a final response without tool calls
  let iterationCount = 0;
  const maxIterations = 10;

  while (agent.status === 'running' && iterationCount < maxIterations) {
    iterationCount++;
    console.log(`[Quark Agent] Iteration ${iterationCount}`);

    // Call LLM
    const thinkingTask = addTask(agent, 'Thinking...', 'llm');
    const response = await callOpenRouter(config, apiMessages, tools);
    
    if (response.error) {
      updateTaskStatus(agent, thinkingTask.id, 'failed', undefined, response.error);
      agent.status = 'error';
      agent.error = response.error;
      notifyStateUpdate(agent);
      return;
    }

    updateTaskStatus(agent, thinkingTask.id, 'completed');

    // If we have tool calls, execute them
    if (response.toolCalls && response.toolCalls.length > 0) {
      // Add assistant message with tool calls
      const assistantMsg: AgentMessage = {
        id: generateId(),
        role: 'assistant',
        content: response.content || '',
        toolCalls: response.toolCalls,
        timestamp: Date.now(),
      };
      agent.messages.push(assistantMsg);
      apiMessages.push({
        role: 'assistant',
        content: response.content || '',
        tool_calls: response.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      });

      // Execute each tool call
      for (const toolCall of response.toolCalls) {
        const toolDef = TOOL_DEFINITIONS.find(t => t.name === toolCall.name);
        const taskDescription = toolDef 
          ? `Using ${toolCall.name}: ${toolDef.description.substring(0, 50)}...`
          : `Executing ${toolCall.name}`;
        
        const task = addTask(agent, taskDescription, toolCall.name);
        task.toolParams = toolCall.arguments;
        notifyStateUpdate(agent);

        // Check if permission is required
        if (toolRequiresPermission(toolCall.name)) {
          updateTaskStatus(agent, task.id, 'awaiting_permission');
          
          let description = '';
          if (toolCall.name === 'inject_script') {
            description = `Run JavaScript: ${(toolCall.arguments as { description?: string }).description || 'Execute custom code'}`;
          } else if (toolCall.name === 'call_api') {
            description = `Make API call to: ${(toolCall.arguments as { url: string }).url}`;
          }

          const approved = await requestPermission(
            agent,
            toolCall.name,
            toolCall.arguments,
            description
          );

          if (!approved) {
            updateTaskStatus(agent, task.id, 'failed', undefined, 'Permission denied by user');
            
            // Add tool result for denied permission
            const toolResultMsg: AgentMessage = {
              id: generateId(),
              role: 'tool',
              content: JSON.stringify({ 
                success: false, 
                error: 'Permission denied by user. Try a different approach or explain why this action is necessary.' 
              }),
              toolCallId: toolCall.id,
              timestamp: Date.now(),
            };
            agent.messages.push(toolResultMsg);
            apiMessages.push({
              role: 'tool',
              content: toolResultMsg.content,
              tool_call_id: toolCall.id,
            });
            
            continue;
          }
        }

        // Execute the tool
        updateTaskStatus(agent, task.id, 'in_progress');
        const result = await toolExecutor.execute(toolCall.name, toolCall.arguments);
        
        // Handle special case for element picker (async user interaction)
        if (toolCall.name === 'pick_element' && result.success) {
          updateTaskStatus(agent, task.id, 'awaiting_permission');
          // The element selection will come through a message
          // For now, we'll just note that we're waiting
        }
        
        updateTaskStatus(
          agent, 
          task.id, 
          result.success ? 'completed' : 'failed',
          result.data,
          result.error
        );

        // Add tool result message
        const toolResultMsg: AgentMessage = {
          id: generateId(),
          role: 'tool',
          content: JSON.stringify(result),
          toolCallId: toolCall.id,
          timestamp: Date.now(),
        };
        agent.messages.push(toolResultMsg);
        apiMessages.push({
          role: 'tool',
          content: toolResultMsg.content,
          tool_call_id: toolCall.id,
        });
      }

      notifyStateUpdate(agent);
      // Continue the loop to let LLM process tool results
      continue;
    }

    // No tool calls - this is the final response
    if (response.content) {
      const finalMsg: AgentMessage = {
        id: generateId(),
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
      };
      agent.messages.push(finalMsg);
      
      // Check if the response contains a script to save
      const codeMatch = response.content.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
      if (codeMatch) {
        const code = codeMatch[1].trim();
        const nameMatch = response.content.match(/(?:Script Name|Name):\s*(.+)/i);
        const name = nameMatch?.[1] || 'Generated Script';
        
        // Save the script
        const script: GeneratedScript = {
          id: activeScript?.id || generateId(),
          name,
          description: userMessage,
          code,
          domain: agent.domain,
          prompt: userMessage,
          model: config.model,
          createdAt: activeScript?.createdAt || Date.now(),
          updatedAt: Date.now(),
          enabled: true,
          autoRun: false,
        };
        
        await saveScript(script);
        agent.activeScriptId = script.id;
      }
    }

    // Mark as completed
    agent.status = 'completed';
    notifyStateUpdate(agent);
    break;
  }

  if (iterationCount >= maxIterations) {
    agent.status = 'error';
    agent.error = 'Maximum iterations reached';
    notifyStateUpdate(agent);
  }
}

// Stop an agent
export function stopAgent(agentId: string): void {
  const agent = activeAgents.get(agentId);
  if (agent) {
    agent.status = 'paused';
    notifyStateUpdate(agent);
  }
}

// Resume an agent with new input
export async function resumeAgent(
  agentId: string, 
  userMessage: string,
  apiEndpoints: Map<string, APIEndpoint[]>
): Promise<void> {
  const agent = activeAgents.get(agentId);
  if (!agent) return;

  // Get active script if any
  let activeScript: GeneratedScript | undefined;
  if (agent.activeScriptId) {
    const result = await chrome.storage.local.get('scripts');
    const scripts = result.scripts?.[agent.domain] || [];
    activeScript = scripts.find((s: GeneratedScript) => s.id === agent.activeScriptId);
  }

  await runAgent(agentId, userMessage, apiEndpoints, activeScript);
}

// Handle element selection from picker
export function handleElementSelected(agentId: string, elementData: unknown): void {
  const agent = activeAgents.get(agentId);
  if (!agent) return;

  // Find the awaiting task
  const awaitingTask = agent.tasks.find(t => t.status === 'awaiting_permission' && t.toolName === 'pick_element');
  if (awaitingTask) {
    updateTaskStatus(agent, awaitingTask.id, 'completed', elementData);
    
    // Add a tool result message
    const toolResultMsg: AgentMessage = {
      id: generateId(),
      role: 'tool',
      content: JSON.stringify({ success: true, data: elementData }),
      timestamp: Date.now(),
    };
    agent.messages.push(toolResultMsg);
    notifyStateUpdate(agent);
  }
}

// Clean up completed agents (call periodically)
export function cleanupAgents(): void {
  const oneHourAgo = Date.now() - 3600000;
  for (const [id, agent] of activeAgents) {
    if ((agent.status === 'completed' || agent.status === 'error') && agent.updatedAt < oneHourAgo) {
      activeAgents.delete(id);
    }
  }
}

