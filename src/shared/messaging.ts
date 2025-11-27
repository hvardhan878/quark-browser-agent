import type { ExtensionMessage, MessageType } from './types';

// Send message to background script
export async function sendToBackground<T, R = unknown>(
  type: MessageType, 
  payload: T
): Promise<R> {
  return chrome.runtime.sendMessage<ExtensionMessage<T>, R>({ type, payload });
}

// Send message to content script in specific tab
export async function sendToTab<T, R = unknown>(
  tabId: number,
  type: MessageType,
  payload: T
): Promise<R> {
  return chrome.tabs.sendMessage<ExtensionMessage<T>, R>(tabId, { type, payload });
}

// Send message to all tabs
export async function broadcastToTabs<T>(
  type: MessageType,
  payload: T
): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type, payload });
      } catch {
        // Tab might not have content script loaded
      }
    }
  }
}

// Get current active tab
export async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

// Get domain from URL
export function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

