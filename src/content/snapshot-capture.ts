// Snapshot Capture - captures rich page context for AI

export interface PageSnapshot {
  url: string;
  title: string;
  timestamp: number;
  viewport: {
    width: number;
    height: number;
  };
  // Key areas of the page
  sections: PageSection[];
  // Interactive elements with context
  interactiveElements: InteractiveElementContext[];
  // Forms with their fields
  forms: FormContext[];
  // Visible text content summary
  textContent: string;
  // Framework detection
  framework?: string;
  // Meta information
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

// Detect which framework the page is using
function detectFramework(): string | undefined {
  // React
  if (document.querySelector('[data-reactroot]') || 
      (window as unknown as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    return 'react';
  }
  
  // Vue
  if (document.querySelector('[data-v-]') || 
      (window as unknown as Record<string, unknown>).__VUE__) {
    return 'vue';
  }
  
  // Angular
  if (document.querySelector('[ng-version]') || 
      document.querySelector('[_nghost]')) {
    return 'angular';
  }
  
  // Next.js
  if (document.querySelector('#__next')) {
    return 'nextjs';
  }
  
  // Svelte
  if (document.querySelector('[class*="svelte-"]')) {
    return 'svelte';
  }
  
  return undefined;
}

// Get a robust selector for an element
function getSelector(element: Element): string {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }
  
  const testId = element.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }
  
  // Build path
  const path: string[] = [];
  let current: Element | null = element;
  
  while (current && current !== document.body && path.length < 4) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    }
    
    const significantClass = Array.from(current.classList).find(c => 
      c.length > 2 && !c.match(/^(p-|m-|w-|h-|flex|grid|text-|bg-)/)
    );
    if (significantClass) {
      selector += `.${CSS.escape(significantClass)}`;
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

// Truncate HTML while keeping structure
function truncateHTML(html: string, maxLength: number): string {
  if (html.length <= maxLength) return html;
  return html.substring(0, maxLength) + '... [truncated]';
}

// Determine element location on page
function getElementLocation(element: Element): InteractiveElementContext['location'] {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  
  // Check if in modal/dialog
  const dialog = element.closest('dialog, [role="dialog"], [role="modal"], .modal');
  if (dialog) return 'modal';
  
  // Check semantic elements
  if (element.closest('header, [role="banner"]')) return 'header';
  if (element.closest('footer, [role="contentinfo"]')) return 'footer';
  if (element.closest('aside, [role="complementary"], nav')) return 'sidebar';
  if (element.closest('main, [role="main"], article')) return 'main';
  
  // Heuristic based on position
  if (rect.top < 100) return 'header';
  if (rect.top > viewportHeight - 150) return 'footer';
  if (rect.left < 250 || rect.right > window.innerWidth - 250) return 'sidebar';
  
  return 'main';
}

// Capture key page sections
function captureSections(): PageSection[] {
  const sections: PageSection[] = [];
  
  // Header
  const header = document.querySelector('header, [role="banner"]');
  if (header) {
    sections.push({
      name: 'header',
      selector: getSelector(header),
      html: truncateHTML(header.outerHTML, 1000),
      role: 'banner',
    });
  }
  
  // Navigation
  const nav = document.querySelector('nav, [role="navigation"]');
  if (nav) {
    sections.push({
      name: 'navigation',
      selector: getSelector(nav),
      html: truncateHTML(nav.outerHTML, 800),
      role: 'navigation',
    });
  }
  
  // Main content
  const main = document.querySelector('main, [role="main"], #root > div, #__next > div');
  if (main) {
    sections.push({
      name: 'main',
      selector: getSelector(main),
      html: truncateHTML(main.innerHTML, 2000),
      role: 'main',
    });
  }
  
  // Sidebar
  const sidebar = document.querySelector('aside, [role="complementary"]');
  if (sidebar) {
    sections.push({
      name: 'sidebar',
      selector: getSelector(sidebar),
      html: truncateHTML(sidebar.outerHTML, 800),
      role: 'complementary',
    });
  }
  
  // Footer
  const footer = document.querySelector('footer, [role="contentinfo"]');
  if (footer) {
    sections.push({
      name: 'footer',
      selector: getSelector(footer),
      html: truncateHTML(footer.outerHTML, 500),
      role: 'contentinfo',
    });
  }
  
  return sections;
}

// Capture interactive elements with rich context
function captureInteractiveElements(): InteractiveElementContext[] {
  const elements: InteractiveElementContext[] = [];
  const seen = new Set<Element>();
  
  // Buttons
  document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]').forEach(el => {
    if (seen.has(el)) return;
    seen.add(el);
    
    elements.push({
      type: 'button',
      selector: getSelector(el),
      text: el.textContent?.trim().substring(0, 100),
      label: el.getAttribute('aria-label') ?? undefined,
      html: truncateHTML(el.outerHTML, 300),
      location: getElementLocation(el),
    });
  });
  
  // Links
  document.querySelectorAll('a[href]').forEach(el => {
    if (seen.has(el)) return;
    seen.add(el);
    
    elements.push({
      type: 'link',
      selector: getSelector(el),
      text: el.textContent?.trim().substring(0, 100),
      label: el.getAttribute('aria-label') ?? undefined,
      html: truncateHTML(el.outerHTML, 300),
      location: getElementLocation(el),
    });
  });
  
  // Toggle switches
  document.querySelectorAll('[role="switch"], input[type="checkbox"], .toggle, .switch').forEach(el => {
    if (seen.has(el)) return;
    seen.add(el);
    
    // Get associated label
    const id = el.getAttribute('id');
    const label = id ? document.querySelector(`label[for="${id}"]`)?.textContent?.trim() : undefined;
    
    elements.push({
      type: 'toggle',
      selector: getSelector(el),
      text: el.textContent?.trim().substring(0, 100),
      label: label ?? el.getAttribute('aria-label') ?? undefined,
      html: truncateHTML((el.closest('.toggle, .switch') ?? el).outerHTML, 500),
      location: getElementLocation(el),
    });
  });
  
  // Limit to most relevant elements
  return elements.slice(0, 50);
}

// Capture forms with their fields
function captureForms(): FormContext[] {
  const forms: FormContext[] = [];
  
  document.querySelectorAll('form').forEach(form => {
    const fields: FormFieldContext[] = [];
    
    form.querySelectorAll('input, select, textarea').forEach(field => {
      const input = field as HTMLInputElement;
      const id = input.id;
      const labelEl = id ? document.querySelector(`label[for="${id}"]`) : field.closest('label');
      
      fields.push({
        type: input.type || field.tagName.toLowerCase(),
        name: input.name ?? undefined,
        label: labelEl?.textContent?.trim().substring(0, 100),
        placeholder: input.placeholder ?? undefined,
        selector: getSelector(field),
      });
    });
    
    forms.push({
      selector: getSelector(form),
      action: form.action ?? undefined,
      method: form.method ?? undefined,
      fields,
      html: truncateHTML(form.outerHTML, 1500),
    });
  });
  
  return forms.slice(0, 10);
}

// Get visible text content summary
function getTextContentSummary(): string {
  const textParts: string[] = [];
  
  // Get headings
  document.querySelectorAll('h1, h2, h3').forEach(el => {
    const text = el.textContent?.trim();
    if (text) textParts.push(`[${el.tagName}] ${text}`);
  });
  
  // Get main content text (first 500 chars)
  const main = document.querySelector('main, [role="main"], article');
  if (main) {
    const text = main.textContent?.replace(/\s+/g, ' ').trim().substring(0, 500);
    if (text) textParts.push(`[content] ${text}...`);
  }
  
  return textParts.join('\n');
}

// Get meta information
function getMetaInfo(): Record<string, string> {
  const meta: Record<string, string> = {};
  
  document.querySelectorAll('meta[name], meta[property]').forEach(el => {
    const name = el.getAttribute('name') ?? el.getAttribute('property');
    const content = el.getAttribute('content');
    if (name && content) {
      meta[name] = content.substring(0, 200);
    }
  });
  
  return meta;
}

// Main function to capture page snapshot
export function capturePageSnapshot(): PageSnapshot {
  return {
    url: window.location.href,
    title: document.title,
    timestamp: Date.now(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    sections: captureSections(),
    interactiveElements: captureInteractiveElements(),
    forms: captureForms(),
    textContent: getTextContentSummary(),
    framework: detectFramework(),
    meta: getMetaInfo(),
  };
}

