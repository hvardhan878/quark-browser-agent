import type { 
  OpenRouterConfig, 
  GeneratedScript, 
  Conversation, 
  SiteContext,
  StorageData 
} from './types';

const DEFAULT_CONFIG: OpenRouterConfig = {
  apiKey: '',
  model: 'anthropic/claude-sonnet-4',
  temperature: 0.7,
  maxTokens: 4096,
};

// Get configuration
export async function getConfig(): Promise<OpenRouterConfig> {
  const result = await chrome.storage.local.get('config');
  return result.config ?? DEFAULT_CONFIG;
}

// Set configuration
export async function setConfig(config: Partial<OpenRouterConfig>): Promise<void> {
  const current = await getConfig();
  await chrome.storage.local.set({ 
    config: { ...current, ...config } 
  });
}

// Get scripts for a domain
export async function getScripts(domain: string): Promise<GeneratedScript[]> {
  const result = await chrome.storage.local.get('scripts');
  const scripts = result.scripts ?? {};
  return scripts[domain] ?? [];
}

// Save a script
export async function saveScript(script: GeneratedScript): Promise<void> {
  const result = await chrome.storage.local.get('scripts');
  const scripts: Record<string, GeneratedScript[]> = result.scripts ?? {};
  
  if (!scripts[script.domain]) {
    scripts[script.domain] = [];
  }
  
  const existingIndex = scripts[script.domain].findIndex(s => s.id === script.id);
  if (existingIndex >= 0) {
    scripts[script.domain][existingIndex] = script;
  } else {
    scripts[script.domain].push(script);
  }
  
  await chrome.storage.local.set({ scripts });
}

// Delete a script
export async function deleteScript(domain: string, scriptId: string): Promise<void> {
  const result = await chrome.storage.local.get('scripts');
  const scripts: Record<string, GeneratedScript[]> = result.scripts ?? {};
  
  if (scripts[domain]) {
    scripts[domain] = scripts[domain].filter(s => s.id !== scriptId);
    await chrome.storage.local.set({ scripts });
  }
}

// Get all scripts (for export)
export async function getAllScripts(): Promise<Record<string, GeneratedScript[]>> {
  const result = await chrome.storage.local.get('scripts');
  return result.scripts ?? {};
}

// Get conversation for a domain
export async function getConversation(domain: string): Promise<Conversation | null> {
  const result = await chrome.storage.local.get('conversations');
  const conversations = result.conversations ?? {};
  return conversations[domain] ?? null;
}

// Save conversation
export async function saveConversation(conversation: Conversation): Promise<void> {
  const result = await chrome.storage.local.get('conversations');
  const conversations: Record<string, Conversation> = result.conversations ?? {};
  conversations[conversation.domain] = conversation;
  await chrome.storage.local.set({ conversations });
}

// Clear conversation
export async function clearConversation(domain: string): Promise<void> {
  const result = await chrome.storage.local.get('conversations');
  const conversations: Record<string, Conversation> = result.conversations ?? {};
  delete conversations[domain];
  await chrome.storage.local.set({ conversations });
}

// Get site context
export async function getSiteContext(domain: string): Promise<SiteContext | null> {
  const result = await chrome.storage.local.get('siteContexts');
  const contexts = result.siteContexts ?? {};
  return contexts[domain] ?? null;
}

// Save site context
export async function saveSiteContext(context: SiteContext): Promise<void> {
  const result = await chrome.storage.local.get('siteContexts');
  const contexts: Record<string, SiteContext> = result.siteContexts ?? {};
  contexts[context.domain] = context;
  await chrome.storage.local.set({ siteContexts: contexts });
}

// Clear all data
export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
}

// Export all data
export async function exportAllData(): Promise<StorageData> {
  const result = await chrome.storage.local.get(null);
  return {
    config: result.config ?? DEFAULT_CONFIG,
    scripts: result.scripts ?? {},
    conversations: result.conversations ?? {},
    siteContexts: result.siteContexts ?? {},
  };
}

// Import data
export async function importData(data: Partial<StorageData>): Promise<void> {
  await chrome.storage.local.set(data);
}

