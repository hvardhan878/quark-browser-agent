import { NetworkInterceptor } from './network-interceptor';
import { OpenRouterClient } from './openrouter-client';
import { getConfig, saveScript, saveSiteContext, getSiteContext } from '../shared/storage';
import { getDomainFromUrl, generateId } from '../shared/messaging';
import type { ExtensionMessage, SiteContext, GeneratedScript, DOMAnalysis, AgentState, PermissionRequest } from '../shared/types';
import type { EnhancedContext } from '../lib/prompt-templates';
import {
  createAgent,
  runAgent,
  stopAgent,
  getAgentState,
  handlePermissionResponse,
  handleElementSelected,
  setStateUpdateCallback,
  setPermissionRequestCallback,
  cleanupAgents,
} from './agent';

// Initialize network interceptor
const networkInterceptor = new NetworkInterceptor();

// Site contexts in memory (persisted to storage periodically)
const siteContexts = new Map<string, SiteContext>();

// Current agent states per tab (for broadcasting updates)
const tabAgentMap = new Map<number, string>(); // tabId -> agentId

// Set up agent callbacks
setStateUpdateCallback((state: AgentState) => {
  // Broadcast state update to sidepanel
  chrome.runtime.sendMessage({
    type: 'AGENT_STATE_UPDATE',
    payload: state,
  }).catch(() => {
    // Sidepanel might not be open
  });
});

setPermissionRequestCallback((request: PermissionRequest) => {
  // Broadcast permission request to sidepanel
  chrome.runtime.sendMessage({
    type: 'AGENT_PERMISSION_REQUEST',
    payload: request,
  }).catch(() => {
    // Sidepanel might not be open
  });
});

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Quark Browser Agent installed');
  
  // Set side panel behavior
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Clean up agents periodically
setInterval(cleanupAgents, 60000); // Every minute

// Handle action click to open side panel
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Handle messages from content script and side panel
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  const tabId = sender.tab?.id;
  
  switch (message.type) {
    case 'GET_SITE_CONTEXT': {
      const tab = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tab[0];
      if (!currentTab?.url) return null;
      
      const domain = getDomainFromUrl(currentTab.url);
      let context = siteContexts.get(domain);
      
      if (!context) {
        // Try to load from storage
        context = await getSiteContext(domain) ?? undefined;
      }
      
      if (!context) {
        // Create new context
        context = {
          domain,
          url: currentTab.url,
          title: currentTab.title ?? '',
          apis: networkInterceptor.getAPIsForDomain(domain),
          dom: { interactiveElements: [], dataContainers: [], forms: [], navigation: [], timestamp: Date.now() },
          cookies: [],
          localStorage: {},
          timestamp: Date.now(),
        };
        siteContexts.set(domain, context);
      } else {
        // Update APIs from interceptor
        context.apis = networkInterceptor.getAPIsForDomain(domain);
        context.timestamp = Date.now();
      }
      
      return context;
    }
    
    case 'DOM_ANALYSIS_RESULT': {
      const { domain, analysis } = message.payload as { domain: string; analysis: DOMAnalysis };
      const context = siteContexts.get(domain);
      if (context) {
        context.dom = analysis;
        context.timestamp = Date.now();
        siteContexts.set(domain, context);
        await saveSiteContext(context);
      }
      return { success: true };
    }
    
    case 'GENERATE_SCRIPT': {
      const { prompt, context } = message.payload as { prompt: string; context: EnhancedContext };
      const config = await getConfig();
      
      if (!config.apiKey) {
        return { error: 'OpenRouter API key not configured' };
      }
      
      const client = new OpenRouterClient(config);
      const result = await client.generateScript(prompt, context);
      
      if (result.error) {
        return { error: result.error };
      }
      
      // Create and save script
      const script: GeneratedScript = {
        id: generateId(),
        name: result.name ?? 'Generated Script',
        description: result.description ?? prompt,
        code: result.code ?? '',
        domain: context.domain,
        prompt,
        model: config.model,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        enabled: true,
        autoRun: false,
      };
      
      await saveScript(script);
      
      return { script, explanation: result.explanation };
    }
    
    case 'INJECT_SCRIPT': {
      const { code, tabId: targetTabId } = message.payload as { code: string; tabId?: number };
      const execTabId = targetTabId ?? tabId;
      
      console.log('[Quark Background] INJECT_SCRIPT received', { 
        targetTabId, 
        senderTabId: tabId, 
        execTabId,
        codeLength: code.length 
      });
      
      if (!execTabId) {
        console.error('[Quark Background] No tab ID provided');
        return { success: false, error: 'No tab ID provided' };
      }
      
      try {
        // Get tab info for debugging
        const tabInfo = await chrome.tabs.get(execTabId);
        console.log('[Quark Background] Injecting into tab:', execTabId, 'URL:', tabInfo.url);
        
        // Check if URL is injectable (not chrome:// or extension pages)
        if (tabInfo.url?.startsWith('chrome://') || tabInfo.url?.startsWith('chrome-extension://')) {
          console.error('[Quark Background] Cannot inject into chrome:// or extension pages');
          return { 
            success: false, 
            error: 'Cannot inject scripts into Chrome internal pages or extension pages' 
          };
        }
        
        // Use Blob URL injection to bypass Trusted Types restrictions
        const results = await chrome.scripting.executeScript({
          target: { tabId: execTabId },
          func: (scriptCode: string) => {
            console.log('[Quark Injected] Injecting script, code length:', scriptCode.length);
            
            try {
              // Method 1: Blob URL (bypasses Trusted Types)
              const blob = new Blob([scriptCode], { type: 'application/javascript' });
              const url = URL.createObjectURL(blob);
              const script = document.createElement('script');
              script.src = url;
              
              return new Promise<{ success: boolean; error?: string }>((resolve) => {
                script.onload = () => {
                  URL.revokeObjectURL(url);
                  script.remove();
                  console.log('[Quark Injected] Script executed successfully via Blob URL');
                  resolve({ success: true });
                };
                script.onerror = () => {
                  URL.revokeObjectURL(url);
                  script.remove();
                  // Fallback to Function constructor
                  try {
                    const fn = new Function(scriptCode);
                    fn();
                    console.log('[Quark Injected] Script executed via Function fallback');
                    resolve({ success: true });
                  } catch (fallbackError) {
                    console.error('[Quark Injected] All methods failed:', fallbackError);
                    resolve({ success: false, error: String(fallbackError) });
                  }
                };
                (document.head || document.documentElement).appendChild(script);
              });
            } catch (error) {
              // Last resort: try eval
              try {
                (0, eval)(scriptCode);
                console.log('[Quark Injected] Script executed via eval fallback');
                return { success: true };
              } catch (evalError) {
                console.error('[Quark Injected] Script execution error:', error, evalError);
                return { success: false, error: String(error) };
              }
            }
          },
          args: [code],
          world: 'MAIN', // Execute in page context to access page's JS
        });
        
        console.log('[Quark Background] Script injection result:', results);
        return results[0]?.result ?? { success: false, error: 'No result returned' };
      } catch (error) {
        console.error('[Quark Background] Script injection failed:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    }
    
    case 'OPEN_SIDEPANEL': {
      const tab = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab[0]?.id) {
        await chrome.sidePanel.open({ tabId: tab[0].id });
      }
      return { success: true };
    }
    
    case 'START_ELEMENT_PICKER': {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTabId = tabs[0]?.id;
      
      if (!currentTabId) {
        return { success: false, error: 'No active tab' };
      }
      
      try {
        await chrome.tabs.sendMessage(currentTabId, { type: 'START_ELEMENT_PICKER', payload: {} });
        return { success: true };
      } catch (error) {
        console.error('[Quark Background] Failed to start element picker:', error);
        return { success: false, error: String(error) };
      }
    }
    
    case 'STOP_ELEMENT_PICKER': {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTabId = tabs[0]?.id;
      
      if (!currentTabId) {
        return { success: false, error: 'No active tab' };
      }
      
      try {
        await chrome.tabs.sendMessage(currentTabId, { type: 'STOP_ELEMENT_PICKER', payload: {} });
        return { success: true };
      } catch (error) {
        console.error('[Quark Background] Failed to stop element picker:', error);
        return { success: false, error: String(error) };
      }
    }
    
    case 'ELEMENT_SELECTED':
    case 'ELEMENT_PICKER_CANCELLED': {
      // These messages are forwarded from content script to sidepanel
      // The sidepanel listens for them directly
      return { success: true };
    }
    
    case 'CAPTURE_SNAPSHOT': {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTabId = tabs[0]?.id;
      
      if (!currentTabId) {
        return { success: false, error: 'No active tab' };
      }
      
      try {
        const result = await chrome.tabs.sendMessage(currentTabId, { type: 'CAPTURE_SNAPSHOT', payload: {} });
        return result;
      } catch (error) {
        console.error('[Quark Background] Failed to capture snapshot:', error);
        return { success: false, error: String(error) };
      }
    }
    
    case 'CAPTURE_SCREENSHOT': {
      try {
        // Get current window
        const currentWindow = await chrome.windows.getCurrent();
        const dataUrl = await chrome.tabs.captureVisibleTab(currentWindow.id!, { format: 'png' });
        return { success: true, screenshot: dataUrl };
      } catch (error) {
        console.error('[Quark Background] Failed to capture screenshot:', error);
        return { success: false, error: String(error) };
      }
    }
    
    case 'AGENT_START': {
      const { userMessage, activeScriptId } = message.payload as { 
        userMessage: string; 
        activeScriptId?: string;
      };
      
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      if (!currentTab?.id || !currentTab.url) {
        return { success: false, error: 'No active tab' };
      }
      
      const domain = getDomainFromUrl(currentTab.url);
      
      // Get active script if specified
      let activeScript: GeneratedScript | undefined;
      if (activeScriptId) {
        const result = await chrome.storage.local.get('scripts');
        const scripts = result.scripts?.[domain] || [];
        activeScript = scripts.find((s: GeneratedScript) => s.id === activeScriptId);
      }
      
      // Create or resume agent
      let existingAgentId = tabAgentMap.get(currentTab.id);
      let agent = existingAgentId ? getAgentState(existingAgentId) : undefined;
      
      let agentId: string;
      if (!agent || agent.status === 'completed' || agent.status === 'error') {
        // Create new agent
        agent = createAgent(domain, currentTab.id, activeScript);
        agentId = agent.id;
        tabAgentMap.set(currentTab.id, agentId);
      } else {
        agentId = existingAgentId!;
      }
      
      // Get API endpoints for the domain
      const apiEndpoints = new Map<string, import('../shared/types').APIEndpoint[]>();
      const endpoints = networkInterceptor.getAPIsForDomain(domain);
      const allEndpoints = endpoints.flatMap(cat => cat.endpoints);
      apiEndpoints.set(domain, allEndpoints);
      
      // Run the agent (this is async but we return immediately)
      runAgent(agentId, userMessage, apiEndpoints, activeScript).catch(err => {
        console.error('[Quark Background] Agent error:', err);
      });
      
      return { success: true, agentId };
    }
    
    case 'AGENT_STOP': {
      const { agentId } = message.payload as { agentId: string };
      stopAgent(agentId);
      return { success: true };
    }
    
    case 'GET_AGENT_STATE': {
      const { agentId } = message.payload as { agentId?: string };
      
      if (agentId) {
        const state = getAgentState(agentId);
        return { success: true, state };
      }
      
      // Get agent for current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      if (currentTab?.id) {
        const currentAgentId = tabAgentMap.get(currentTab.id);
        if (currentAgentId) {
          const state = getAgentState(currentAgentId);
          return { success: true, state };
        }
      }
      
      return { success: true, state: null };
    }
    
    case 'AGENT_PERMISSION_RESPONSE': {
      const { requestId, approved } = message.payload as { requestId: string; approved: boolean };
      handlePermissionResponse(requestId, approved);
      return { success: true };
    }
    
    case 'VERIFY_ELEMENT': {
      const { selector } = message.payload as { selector: string };
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTabId = tabs[0]?.id;
      
      if (!currentTabId) {
        return { success: false, error: 'No active tab' };
      }
      
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func: (sel: string) => {
            const elements = document.querySelectorAll(sel);
            return {
              exists: elements.length > 0,
              count: elements.length,
              elements: Array.from(elements).slice(0, 5).map(el => ({
                tagName: el.tagName,
                id: el.id || undefined,
                textContent: el.textContent?.trim().substring(0, 100),
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
    
    case 'READ_PAGE_CONTENT': {
      const { selector } = message.payload as { selector?: string };
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTabId = tabs[0]?.id;
      
      if (!currentTabId) {
        return { success: false, error: 'No active tab' };
      }
      
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func: (sel?: string) => {
            if (sel) {
              const element = document.querySelector(sel);
              if (!element) return { found: false };
              return {
                found: true,
                textContent: element.textContent?.trim().substring(0, 5000),
              };
            }
            return {
              found: true,
              title: document.title,
              textContent: document.body.textContent?.trim().substring(0, 5000),
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
    
    case 'CALL_API': {
      const { url, method, headers, body } = message.payload as {
        url: string;
        method: string;
        headers?: string;
        body?: string;
      };
      
      try {
        const parsedHeaders: Record<string, string> = headers ? JSON.parse(headers) : {};
        const response = await fetch(url, {
          method,
          headers: parsedHeaders,
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
            body: responseData,
          },
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
    
    default:
      return { error: 'Unknown message type' };
  }
}

// Handle element selection from content script and forward to agent
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'ELEMENT_SELECTED' && sender.tab?.id) {
    const agentId = tabAgentMap.get(sender.tab.id);
    if (agentId) {
      handleElementSelected(agentId, message.payload);
    }
  }
});

// Periodically persist site contexts
setInterval(async () => {
  for (const [, context] of siteContexts) {
    await saveSiteContext(context);
  }
}, 30000); // Every 30 seconds

// Clean up old contexts on startup
chrome.runtime.onStartup.addListener(() => {
  siteContexts.clear();
});

console.log('Quark background service worker initialized');

