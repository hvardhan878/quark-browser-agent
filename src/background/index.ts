import { NetworkInterceptor } from './network-interceptor';
import { OpenRouterClient } from './openrouter-client';
import { getConfig, saveScript, saveSiteContext, getSiteContext } from '../shared/storage';
import { getDomainFromUrl, generateId } from '../shared/messaging';
import type { ExtensionMessage, SiteContext, GeneratedScript, DOMAnalysis } from '../shared/types';
import type { EnhancedContext } from '../lib/prompt-templates';

// Initialize network interceptor
const networkInterceptor = new NetworkInterceptor();

// Site contexts in memory (persisted to storage periodically)
const siteContexts = new Map<string, SiteContext>();

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Quark Browser Agent installed');
  
  // Set side panel behavior
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

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
        
        // Use script element injection to bypass Trusted Types restrictions
        const results = await chrome.scripting.executeScript({
          target: { tabId: execTabId },
          func: (scriptCode: string) => {
            try {
              console.log('[Quark Injected] Creating script element, code length:', scriptCode.length);
              
              // Create a script element - this bypasses Trusted Types CSP
              const script = document.createElement('script');
              script.textContent = scriptCode;
              
              // Inject into the document
              (document.head || document.documentElement).appendChild(script);
              
              // Remove the script element after execution (optional cleanup)
              script.remove();
              
              console.log('[Quark Injected] Script executed successfully');
              return { success: true };
            } catch (error) {
              console.error('[Quark Injected] Script execution error:', error);
              return { success: false, error: String(error) };
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
    
    default:
      return { error: 'Unknown message type' };
  }
}

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

