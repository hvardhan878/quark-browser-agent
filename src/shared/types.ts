// API Request/Response Types
export interface CapturedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  type: 'xhr' | 'fetch' | 'websocket';
  initiator?: string;
}

export interface CapturedResponse {
  requestId: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
}

export interface APIEndpoint {
  url: string;
  method: string;
  baseUrl: string;
  path: string;
  queryParams: Record<string, string>;
  requestSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  authType?: 'bearer' | 'cookie' | 'api-key' | 'none';
  callCount: number;
  lastCalled: number;
}

export interface APICategory {
  name: string;
  endpoints: APIEndpoint[];
  type: 'rest' | 'graphql' | 'websocket' | 'unknown';
}

// DOM Analysis Types
export interface DOMElement {
  selector: string;
  tagName: string;
  id?: string;
  classes: string[];
  textContent?: string;
  attributes: Record<string, string>;
  isInteractive: boolean;
  boundData?: string;
}

export interface DOMAnalysis {
  interactiveElements: DOMElement[];
  dataContainers: DOMElement[];
  forms: DOMElement[];
  navigation: DOMElement[];
  timestamp: number;
}

// Site Context Types
export interface SiteContext {
  domain: string;
  url: string;
  title: string;
  apis: APICategory[];
  dom: DOMAnalysis;
  cookies: string[];
  localStorage: Record<string, string>;
  timestamp: number;
}

// Script Types
export interface GeneratedScript {
  id: string;
  name: string;
  description: string;
  code: string;
  domain: string;
  prompt: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  enabled: boolean;
  autoRun: boolean;
}

export interface ScriptExecution {
  scriptId: string;
  status: 'success' | 'error';
  result?: unknown;
  error?: string;
  timestamp: number;
}

// Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  scriptId?: string;
}

export interface Conversation {
  id: string;
  domain: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// OpenRouter Types
export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  pricing: {
    prompt: number;
    completion: number;
  };
}

// Element Picker Types
export interface SelectedElement {
  selector: string;
  alternativeSelectors: string[];
  tagName: string;
  id?: string;
  classes: string[];
  textContent?: string;
  innerHTML: string;
  outerHTML: string;
  attributes: Record<string, string>;
  boundingRect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  parentHTML?: string;
  siblingInfo?: string;
}

// Page Snapshot Types
export interface PageSnapshot {
  url: string;
  title: string;
  timestamp: number;
  viewport: {
    width: number;
    height: number;
  };
  sections: PageSection[];
  interactiveElements: InteractiveElementContext[];
  forms: FormContext[];
  textContent: string;
  framework?: string;
  meta: Record<string, string>;
}

export interface PageSection {
  name: string;
  selector: string;
  html: string;
  role?: string;
}

export interface InteractiveElementContext {
  type: 'button' | 'link' | 'input' | 'select' | 'toggle' | 'other';
  selector: string;
  text?: string;
  label?: string;
  html: string;
  location: 'header' | 'main' | 'sidebar' | 'footer' | 'modal' | 'unknown';
}

export interface FormContext {
  selector: string;
  action?: string;
  method?: string;
  fields: FormFieldContext[];
  html: string;
}

export interface FormFieldContext {
  type: string;
  name?: string;
  label?: string;
  placeholder?: string;
  selector: string;
}

// Message Types for Extension Communication
export type MessageType =
  | 'GET_SITE_CONTEXT'
  | 'SITE_CONTEXT_UPDATED'
  | 'CAPTURE_REQUEST'
  | 'CAPTURE_RESPONSE'
  | 'ANALYZE_DOM'
  | 'DOM_ANALYSIS_RESULT'
  | 'INJECT_SCRIPT'
  | 'SCRIPT_RESULT'
  | 'GENERATE_SCRIPT'
  | 'OPEN_SIDEPANEL'
  | 'START_ELEMENT_PICKER'
  | 'STOP_ELEMENT_PICKER'
  | 'ELEMENT_SELECTED'
  | 'ELEMENT_PICKER_CANCELLED'
  | 'CAPTURE_SNAPSHOT'
  | 'CAPTURE_SCREENSHOT';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload: T;
  tabId?: number;
}

// Storage Types
export interface StorageData {
  config: OpenRouterConfig;
  scripts: Record<string, GeneratedScript[]>;
  conversations: Record<string, Conversation>;
  siteContexts: Record<string, SiteContext>;
}

// Export Types
export interface ExportData {
  domain: string;
  exportedAt: number;
  apis: APICategory[];
  scripts: GeneratedScript[];
  documentation: string;
}

