import type { SiteContext, APICategory, APIEndpoint, DOMElement, SelectedElement, PageSnapshot } from '../shared/types';

// Extended context that can include selected element, page snapshot, and screenshot
export interface EnhancedContext extends SiteContext {
  selectedElement?: SelectedElement;
  pageSnapshot?: PageSnapshot;
  screenshot?: string; // Base64 data URL for vision models
}

export function buildSystemPrompt(context: EnhancedContext): string {
  let systemPrompt = `You are Quark, an AI assistant that helps users customize and modify websites by generating JavaScript code to inject into web pages.

Your role is to:
1. Understand the user's intent for website modifications
2. Analyze the provided website context (APIs, DOM structure, selected elements)
3. Generate clean, safe, and effective JavaScript code that works on this specific page

Guidelines for code generation:
- Write self-contained JavaScript that runs in the page context
- Use modern ES6+ syntax
- Handle errors gracefully with try-catch blocks
- Avoid infinite loops or recursive calls that could crash the page
- Do not make requests to external domains unless specifically requested
- Use the exact selectors provided when available - they are verified to exist on the page
- For multiple selector strategies, use a fallback chain pattern like:
  \`\`\`javascript
  function findElement(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }
  \`\`\`
- For API interception, use fetch/XMLHttpRequest wrapping patterns
- Add comments explaining what the code does
- Wait for elements if they might load dynamically - use this pattern:
  \`\`\`javascript
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) { observer.disconnect(); resolve(el); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error('Element not found')); }, timeout);
    });
  }
  \`\`\`

IMPORTANT: When a user has selected an element, use the provided selector(s). If a user asks to modify "this element" or "the selected element", use the primary selector provided.

Response format:
1. Brief explanation of what you'll do
2. JavaScript code in a \`\`\`javascript code block
3. Any caveats or notes about the implementation

Current website context:
- Domain: ${context.domain}
- URL: ${context.url}
- Title: ${context.title}`;

  // Add framework info if detected
  if (context.pageSnapshot?.framework) {
    systemPrompt += `\n- Framework: ${context.pageSnapshot.framework}`;
  }

  // Add screenshot context if available
  if (context.screenshot) {
    systemPrompt += `\n\n📸 SCREENSHOT PROVIDED: A screenshot of the current page is attached. Use it to understand the visual layout and identify elements accurately.`;
  }

  return systemPrompt;
}

export function buildUserPrompt(userRequest: string, context: EnhancedContext): string {
  let prompt = `User request: ${userRequest}\n\n`;

  // Add selected element context (HIGH PRIORITY - user explicitly selected this)
  if (context.selectedElement) {
    prompt += `🎯 USER SELECTED ELEMENT (use these exact selectors):\n`;
    prompt += formatSelectedElement(context.selectedElement);
    prompt += '\n';
  }

  // Add page snapshot context if available
  if (context.pageSnapshot) {
    prompt += `📸 PAGE SNAPSHOT (detailed page structure):\n`;
    prompt += formatPageSnapshot(context.pageSnapshot);
    prompt += '\n';
  }

  // Add API context
  if (context.apis.length > 0) {
    prompt += `🌐 Available APIs detected on this page:\n`;
    prompt += formatAPIs(context.apis);
    prompt += '\n';
  }

  // Add DOM context (basic analysis)
  if (context.dom.interactiveElements.length > 0 || context.dom.dataContainers.length > 0) {
    prompt += `📄 Basic DOM Structure:\n`;
    prompt += formatDOM(context.dom);
    prompt += '\n';
  }

  prompt += `Generate JavaScript code to accomplish the user's request. Use the exact selectors provided when available. Make sure the code is safe, efficient, and handles edge cases.`;

  return prompt;
}

function formatSelectedElement(element: SelectedElement): string {
  let output = '';
  
  output += `Tag: <${element.tagName.toLowerCase()}>\n`;
  output += `Primary Selector: ${element.selector}\n`;
  
  if (element.alternativeSelectors.length > 0) {
    output += `Alternative Selectors (fallback options):\n`;
    for (const sel of element.alternativeSelectors.slice(0, 5)) {
      output += `  - ${sel}\n`;
    }
  }
  
  if (element.id) {
    output += `ID: ${element.id}\n`;
  }
  
  if (element.classes.length > 0) {
    output += `Classes: ${element.classes.join(', ')}\n`;
  }
  
  if (element.textContent) {
    output += `Text Content: "${element.textContent.substring(0, 100)}${element.textContent.length > 100 ? '...' : ''}"\n`;
  }
  
  output += `\nActual HTML of selected element:\n\`\`\`html\n${element.outerHTML}\n\`\`\`\n`;
  
  if (element.parentHTML) {
    output += `Parent element: ${element.parentHTML}\n`;
  }
  
  if (element.siblingInfo) {
    output += `Position: ${element.siblingInfo}\n`;
  }
  
  return output;
}

function formatPageSnapshot(snapshot: PageSnapshot): string {
  let output = '';
  
  output += `Page: ${snapshot.title}\n`;
  output += `Viewport: ${snapshot.viewport.width}x${snapshot.viewport.height}\n`;
  
  if (snapshot.framework) {
    output += `Framework detected: ${snapshot.framework}\n`;
  }
  
  // Key sections
  if (snapshot.sections.length > 0) {
    output += `\nPage Sections:\n`;
    for (const section of snapshot.sections) {
      output += `  - ${section.name} (${section.selector})\n`;
    }
  }
  
  // Interactive elements summary
  if (snapshot.interactiveElements.length > 0) {
    output += `\nKey Interactive Elements (${snapshot.interactiveElements.length} total):\n`;
    
    // Group by type
    const byType: Record<string, typeof snapshot.interactiveElements> = {};
    for (const el of snapshot.interactiveElements) {
      if (!byType[el.type]) byType[el.type] = [];
      byType[el.type].push(el);
    }
    
    for (const [type, elements] of Object.entries(byType)) {
      output += `  ${type}s (${elements.length}):\n`;
      for (const el of elements.slice(0, 5)) {
        output += `    - "${el.text || el.label || 'no text'}" → ${el.selector} [${el.location}]\n`;
      }
      if (elements.length > 5) {
        output += `    ... and ${elements.length - 5} more\n`;
      }
    }
  }
  
  // Forms
  if (snapshot.forms.length > 0) {
    output += `\nForms (${snapshot.forms.length}):\n`;
    for (const form of snapshot.forms.slice(0, 3)) {
      output += `  - ${form.selector} with ${form.fields.length} fields\n`;
      for (const field of form.fields.slice(0, 5)) {
        output += `    • ${field.type}: "${field.label || field.name || 'unlabeled'}"\n`;
      }
    }
  }
  
  // Text content summary
  if (snapshot.textContent) {
    output += `\nPage text summary:\n${snapshot.textContent.substring(0, 500)}...\n`;
  }
  
  return output;
}

function formatAPIs(apis: APICategory[]): string {
  let output = '';
  
  for (const category of apis) {
    output += `\n### ${category.name} (${category.type})\n`;
    
    for (const endpoint of category.endpoints.slice(0, 10)) { // Limit to 10 per category
      output += formatEndpoint(endpoint);
    }
    
    if (category.endpoints.length > 10) {
      output += `  ... and ${category.endpoints.length - 10} more endpoints\n`;
    }
  }
  
  return output;
}

function formatEndpoint(endpoint: APIEndpoint): string {
  let output = `- ${endpoint.method} ${endpoint.path}`;
  
  if (Object.keys(endpoint.queryParams).length > 0) {
    output += ` (params: ${Object.keys(endpoint.queryParams).join(', ')})`;
  }
  
  if (endpoint.authType && endpoint.authType !== 'none') {
    output += ` [auth: ${endpoint.authType}]`;
  }
  
  output += ` - called ${endpoint.callCount}x\n`;
  
  if (endpoint.requestSchema) {
    output += `    Request schema: ${JSON.stringify(endpoint.requestSchema, null, 2).substring(0, 200)}\n`;
  }
  
  return output;
}

function formatDOM(dom: { interactiveElements: DOMElement[]; dataContainers: DOMElement[]; forms: DOMElement[]; navigation: DOMElement[] }): string {
  let output = '';
  
  if (dom.interactiveElements.length > 0) {
    output += '\nInteractive Elements:\n';
    for (const el of dom.interactiveElements.slice(0, 10)) {
      output += formatDOMElement(el);
    }
  }
  
  if (dom.dataContainers.length > 0) {
    output += '\nData Containers:\n';
    for (const el of dom.dataContainers.slice(0, 10)) {
      output += formatDOMElement(el);
    }
  }
  
  if (dom.forms.length > 0) {
    output += '\nForms:\n';
    for (const el of dom.forms.slice(0, 5)) {
      output += formatDOMElement(el);
    }
  }
  
  return output;
}

function formatDOMElement(el: DOMElement): string {
  let output = `- <${el.tagName.toLowerCase()}`;
  
  if (el.id) {
    output += ` id="${el.id}"`;
  }
  
  if (el.classes.length > 0) {
    output += ` class="${el.classes.slice(0, 3).join(' ')}"`;
  }
  
  output += `> selector: "${el.selector}"`;
  
  if (el.textContent) {
    const text = el.textContent.substring(0, 50);
    output += ` text: "${text}${el.textContent.length > 50 ? '...' : ''}"`;
  }
  
  output += '\n';
  
  return output;
}

// Export prompt for generating Tampermonkey-compatible scripts
export function buildTampermonkeyPrompt(script: { name: string; description: string; code: string; domain: string }): string {
  return `// ==UserScript==
// @name         ${script.name}
// @namespace    quark-browser-agent
// @version      1.0
// @description  ${script.description}
// @author       Quark Browser Agent
// @match        *://${script.domain}/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    
${script.code.split('\n').map(line => '    ' + line).join('\n')}
})();`;
}

// Export prompt for PM documentation
export function buildExportDocumentation(context: SiteContext, scripts: Array<{ name: string; description: string; code: string; prompt: string }>): string {
  let doc = `# Website Analysis Report: ${context.domain}\n\n`;
  doc += `Generated by Quark Browser Agent\n`;
  doc += `Date: ${new Date().toISOString()}\n`;
  doc += `URL: ${context.url}\n\n`;
  
  doc += `## Discovered APIs\n\n`;
  for (const category of context.apis) {
    doc += `### ${category.name} (${category.type})\n\n`;
    doc += `| Method | Endpoint | Auth | Calls |\n`;
    doc += `|--------|----------|------|-------|\n`;
    for (const endpoint of category.endpoints) {
      doc += `| ${endpoint.method} | ${endpoint.path} | ${endpoint.authType ?? 'none'} | ${endpoint.callCount} |\n`;
    }
    doc += '\n';
  }
  
  doc += `## Generated Scripts\n\n`;
  for (const script of scripts) {
    doc += `### ${script.name}\n\n`;
    doc += `**User Request:** ${script.prompt}\n\n`;
    doc += `**Description:** ${script.description}\n\n`;
    doc += `\`\`\`javascript\n${script.code}\n\`\`\`\n\n`;
  }
  
  doc += `## DOM Structure Summary\n\n`;
  doc += `- Interactive Elements: ${context.dom.interactiveElements.length}\n`;
  doc += `- Data Containers: ${context.dom.dataContainers.length}\n`;
  doc += `- Forms: ${context.dom.forms.length}\n`;
  doc += `- Navigation Elements: ${context.dom.navigation.length}\n`;
  
  return doc;
}

