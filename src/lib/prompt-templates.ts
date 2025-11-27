import type { SiteContext, APICategory, APIEndpoint, DOMElement } from '../shared/types';

export function buildSystemPrompt(context: SiteContext): string {
  return `You are Quark, an AI assistant that helps users customize and modify websites by generating JavaScript code to inject into web pages.

Your role is to:
1. Understand the user's intent for website modifications
2. Analyze the provided website context (APIs, DOM structure)
3. Generate clean, safe, and effective JavaScript code

Guidelines for code generation:
- Write self-contained JavaScript that runs in the page context
- Use modern ES6+ syntax
- Handle errors gracefully with try-catch blocks
- Avoid infinite loops or recursive calls that could crash the page
- Do not make requests to external domains unless specifically requested
- Prefer querySelector/querySelectorAll for DOM manipulation
- For API interception, use fetch/XMLHttpRequest wrapping patterns
- Add comments explaining what the code does

Response format:
1. Brief explanation of what you'll do
2. JavaScript code in a \`\`\`javascript code block
3. Any caveats or notes about the implementation

Current website context:
- Domain: ${context.domain}
- URL: ${context.url}
- Title: ${context.title}`;
}

export function buildUserPrompt(userRequest: string, context: SiteContext): string {
  let prompt = `User request: ${userRequest}\n\n`;

  // Add API context
  if (context.apis.length > 0) {
    prompt += `Available APIs detected on this page:\n`;
    prompt += formatAPIs(context.apis);
    prompt += '\n';
  }

  // Add DOM context
  if (context.dom.interactiveElements.length > 0 || context.dom.dataContainers.length > 0) {
    prompt += `DOM Structure:\n`;
    prompt += formatDOM(context.dom);
    prompt += '\n';
  }

  prompt += `Generate JavaScript code to accomplish the user's request. Make sure the code is safe, efficient, and handles edge cases.`;

  return prompt;
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

