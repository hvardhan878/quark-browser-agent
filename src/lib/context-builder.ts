import type { SiteContext, APICategory, DOMAnalysis } from '../shared/types';

// Build a summarized context for AI consumption
export function buildSummarizedContext(context: SiteContext): string {
  const parts: string[] = [];
  
  parts.push(`Site: ${context.domain}`);
  parts.push(`Title: ${context.title}`);
  
  // Summarize APIs
  const apiCount = context.apis.reduce((sum, cat) => sum + cat.endpoints.length, 0);
  if (apiCount > 0) {
    parts.push(`APIs: ${apiCount} endpoints discovered`);
    
    // List top APIs by call count
    const allEndpoints = context.apis.flatMap(cat => cat.endpoints);
    const topEndpoints = allEndpoints
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 5);
    
    for (const ep of topEndpoints) {
      parts.push(`  - ${ep.method} ${ep.path} (${ep.callCount} calls)`);
    }
  }
  
  // Summarize DOM
  const domSummary = summarizeDOM(context.dom);
  if (domSummary) {
    parts.push(domSummary);
  }
  
  return parts.join('\n');
}

function summarizeDOM(dom: DOMAnalysis): string {
  const counts = {
    interactive: dom.interactiveElements.length,
    data: dom.dataContainers.length,
    forms: dom.forms.length,
    nav: dom.navigation.length,
  };
  
  if (counts.interactive + counts.data + counts.forms + counts.nav === 0) {
    return '';
  }
  
  const parts: string[] = ['DOM:'];
  
  if (counts.interactive > 0) {
    parts.push(`  - ${counts.interactive} interactive elements`);
  }
  if (counts.data > 0) {
    parts.push(`  - ${counts.data} data containers`);
  }
  if (counts.forms > 0) {
    parts.push(`  - ${counts.forms} forms`);
  }
  if (counts.nav > 0) {
    parts.push(`  - ${counts.nav} navigation elements`);
  }
  
  return parts.join('\n');
}

// Merge new API data with existing context
export function mergeAPIData(existing: APICategory[], incoming: APICategory[]): APICategory[] {
  const merged = new Map<string, APICategory>();
  
  // Add existing
  for (const cat of existing) {
    merged.set(cat.name, { ...cat, endpoints: [...cat.endpoints] });
  }
  
  // Merge incoming
  for (const cat of incoming) {
    const existingCat = merged.get(cat.name);
    
    if (existingCat) {
      // Merge endpoints
      const endpointMap = new Map(
        existingCat.endpoints.map(ep => [`${ep.method}:${ep.path}`, ep])
      );
      
      for (const ep of cat.endpoints) {
        const key = `${ep.method}:${ep.path}`;
        const existingEp = endpointMap.get(key);
        
        if (existingEp) {
          existingEp.callCount += ep.callCount;
          existingEp.lastCalled = Math.max(existingEp.lastCalled, ep.lastCalled);
          existingEp.queryParams = { ...existingEp.queryParams, ...ep.queryParams };
        } else {
          endpointMap.set(key, ep);
        }
      }
      
      existingCat.endpoints = Array.from(endpointMap.values());
    } else {
      merged.set(cat.name, cat);
    }
  }
  
  return Array.from(merged.values());
}

// Filter context to reduce token usage
export function filterContextForPrompt(context: SiteContext, maxEndpoints = 20): SiteContext {
  const filteredApis = context.apis.map(cat => ({
    ...cat,
    endpoints: cat.endpoints
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, Math.ceil(maxEndpoints / context.apis.length)),
  }));
  
  const filteredDom: DOMAnalysis = {
    ...context.dom,
    interactiveElements: context.dom.interactiveElements.slice(0, 15),
    dataContainers: context.dom.dataContainers.slice(0, 10),
    forms: context.dom.forms.slice(0, 5),
    navigation: context.dom.navigation.slice(0, 5),
  };
  
  return {
    ...context,
    apis: filteredApis,
    dom: filteredDom,
  };
}

// Estimate token count (rough approximation)
export function estimateTokens(context: SiteContext): number {
  const json = JSON.stringify(context);
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(json.length / 4);
}

