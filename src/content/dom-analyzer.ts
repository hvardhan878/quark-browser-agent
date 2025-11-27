import type { DOMElement, DOMAnalysis } from '../shared/types';

export class DOMAnalyzer {
  analyze(): DOMAnalysis {
    return {
      interactiveElements: this.findInteractiveElements(),
      dataContainers: this.findDataContainers(),
      forms: this.findForms(),
      navigation: this.findNavigation(),
      timestamp: Date.now(),
    };
  }

  private findInteractiveElements(): DOMElement[] {
    const selectors = [
      'button',
      'a[href]',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[onclick]',
      '[data-action]',
    ];
    
    const elements = document.querySelectorAll(selectors.join(', '));
    return this.mapElements(Array.from(elements).slice(0, 50), true);
  }

  private findDataContainers(): DOMElement[] {
    const containers: Element[] = [];
    
    // Find elements that likely contain data
    const listItems = document.querySelectorAll('[class*="list"], [class*="grid"], [class*="card"], [class*="item"]');
    containers.push(...Array.from(listItems).slice(0, 20));
    
    // Find tables
    const tables = document.querySelectorAll('table');
    containers.push(...Array.from(tables).slice(0, 5));
    
    // Find elements with data attributes
    const dataElements = document.querySelectorAll('[data-id], [data-item], [data-content]');
    containers.push(...Array.from(dataElements).slice(0, 20));
    
    return this.mapElements(containers, false);
  }

  private findForms(): DOMElement[] {
    const forms = document.querySelectorAll('form');
    return this.mapElements(Array.from(forms).slice(0, 10), false);
  }

  private findNavigation(): DOMElement[] {
    const navElements = document.querySelectorAll('nav, [role="navigation"], header, [class*="nav"], [class*="menu"]');
    return this.mapElements(Array.from(navElements).slice(0, 10), false);
  }

  private mapElements(elements: Element[], includeText: boolean): DOMElement[] {
    return elements.map(el => this.mapElement(el, includeText)).filter(Boolean) as DOMElement[];
  }

  private mapElement(el: Element, includeText: boolean): DOMElement | null {
    try {
      const selector = this.getUniqueSelector(el);
      if (!selector) return null;

      const htmlEl = el as HTMLElement;
      
      return {
        selector,
        tagName: el.tagName,
        id: el.id || undefined,
        classes: Array.from(el.classList).slice(0, 5),
        textContent: includeText ? this.getTextContent(htmlEl) : undefined,
        attributes: this.getRelevantAttributes(el),
        isInteractive: this.isInteractive(el),
        boundData: this.detectBoundData(el),
      };
    } catch {
      return null;
    }
  }

  private getUniqueSelector(el: Element): string {
    // Try ID first
    if (el.id) {
      return `#${CSS.escape(el.id)}`;
    }

    // Try data-testid or similar
    const testId = el.getAttribute('data-testid') || el.getAttribute('data-test');
    if (testId) {
      return `[data-testid="${CSS.escape(testId)}"]`;
    }

    // Build path
    const path: string[] = [];
    let current: Element | null = el;
    
    while (current && current !== document.body && path.length < 5) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector = `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }
      
      if (current.classList.length > 0) {
        const significantClass = Array.from(current.classList).find(c => 
          !c.match(/^(active|open|show|hide|visible|hidden|disabled|enabled)$/)
        );
        if (significantClass) {
          selector += `.${CSS.escape(significantClass)}`;
        }
      }
      
      // Add nth-child if needed
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }
      
      path.unshift(selector);
      current = current.parentElement;
    }
    
    return path.join(' > ');
  }

  private getTextContent(el: HTMLElement): string | undefined {
    // Get direct text content, not from children
    const text = Array.from(el.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent?.trim())
      .filter(Boolean)
      .join(' ');
    
    if (text) return text.substring(0, 100);
    
    // Fallback to innerText for buttons, links
    if (['BUTTON', 'A', 'LABEL'].includes(el.tagName)) {
      return el.innerText?.substring(0, 100);
    }
    
    return undefined;
  }

  private getRelevantAttributes(el: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    const relevant = ['href', 'src', 'type', 'name', 'value', 'placeholder', 'aria-label', 'role', 'data-action'];
    
    for (const attr of relevant) {
      const value = el.getAttribute(attr);
      if (value) {
        attrs[attr] = value.substring(0, 100);
      }
    }
    
    return attrs;
  }

  private isInteractive(el: Element): boolean {
    const tagName = el.tagName.toLowerCase();
    const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
    
    if (interactiveTags.includes(tagName)) return true;
    if (el.getAttribute('role') === 'button') return true;
    if (el.hasAttribute('onclick')) return true;
    if (el.hasAttribute('tabindex')) return true;
    
    return false;
  }

  private detectBoundData(el: Element): string | undefined {
    // Look for data binding patterns
    const dataAttrs = Array.from(el.attributes)
      .filter(attr => attr.name.startsWith('data-'))
      .map(attr => `${attr.name}=${attr.value}`)
      .join(', ');
    
    if (dataAttrs) return dataAttrs;
    
    // Check for framework-specific bindings
    const ngBind = el.getAttribute('ng-bind') || el.getAttribute('ng-model');
    if (ngBind) return `angular:${ngBind}`;
    
    const vModel = el.getAttribute('v-model');
    if (vModel) return `vue:${vModel}`;
    
    return undefined;
  }
}

