// Element Picker - allows users to click and select elements on the page

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

let isPickerActive = false;
let highlightOverlay: HTMLElement | null = null;

// Create the highlight overlay element
function createHighlightOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = 'quark-element-picker-overlay';
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    background: rgba(99, 102, 241, 0.3);
    border: 2px solid #6366f1;
    border-radius: 4px;
    z-index: 2147483647;
    transition: all 0.1s ease;
    display: none;
  `;
  document.body.appendChild(overlay);
  return overlay;
}

// Create info tooltip
function createInfoTooltip(): HTMLElement {
  const tooltip = document.createElement('div');
  tooltip.id = 'quark-element-picker-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    background: #1a1a25;
    color: #f1f5f9;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    z-index: 2147483647;
    pointer-events: none;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: none;
  `;
  document.body.appendChild(tooltip);
  return tooltip;
}

let infoTooltip: HTMLElement | null = null;

// Generate multiple selector strategies for an element
function generateSelectors(element: Element): { primary: string; alternatives: string[] } {
  const selectors: string[] = [];
  
  // 1. ID selector (most specific)
  if (element.id) {
    selectors.push(`#${CSS.escape(element.id)}`);
  }
  
  // 2. data-testid selector
  const testId = element.getAttribute('data-testid');
  if (testId) {
    selectors.push(`[data-testid="${CSS.escape(testId)}"]`);
  }
  
  // 3. aria-label selector
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    selectors.push(`[aria-label="${CSS.escape(ariaLabel)}"]`);
  }
  
  // 4. Unique class combination
  if (element.classList.length > 0) {
    const uniqueClasses = Array.from(element.classList)
      .filter(c => !c.match(/^(active|hover|focus|open|show|hide|visible|hidden)$/))
      .slice(0, 3);
    if (uniqueClasses.length > 0) {
      const classSelector = uniqueClasses.map(c => `.${CSS.escape(c)}`).join('');
      // Check if this selector is unique
      if (document.querySelectorAll(classSelector).length === 1) {
        selectors.push(classSelector);
      }
    }
  }
  
  // 5. Tag + text content (for buttons, links)
  const textContent = element.textContent?.trim();
  if (textContent && textContent.length < 50 && ['BUTTON', 'A', 'LABEL', 'SPAN'].includes(element.tagName)) {
    const escapedText = textContent.replace(/"/g, '\\"');
    // This is a pseudo-selector hint for the AI
    selectors.push(`${element.tagName.toLowerCase()}:contains("${escapedText}")`);
  }
  
  // 6. Nth-child path
  const nthChildPath = getNthChildPath(element);
  if (nthChildPath) {
    selectors.push(nthChildPath);
  }
  
  // 7. XPath-style unique path
  const uniquePath = getUniquePath(element);
  if (uniquePath && !selectors.includes(uniquePath)) {
    selectors.push(uniquePath);
  }
  
  return {
    primary: selectors[0] || getUniquePath(element) || element.tagName.toLowerCase(),
    alternatives: selectors.slice(1),
  };
}

// Get nth-child path to element
function getNthChildPath(element: Element): string {
  const path: string[] = [];
  let depth = 0;
  
  // Use a simple iteration instead of reassigning current
  let el: Element | null = element;
  while (el && el !== document.body && depth < 5) {
    let selector = el.tagName.toLowerCase();
    
    if (el.id) {
      selector = `#${CSS.escape(el.id)}`;
      path.unshift(selector);
      break;
    }
    
    const parent: Element | null = el.parentElement;
    if (parent) {
      const tagName = el.tagName;
      const siblings = Array.from(parent.children) as Element[];
      const sameTags = siblings.filter(s => s.tagName === tagName);
      if (sameTags.length > 1) {
        const index = sameTags.indexOf(el) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    
    path.unshift(selector);
    el = parent;
    depth++;
  }
  
  return path.join(' > ');
}

// Get unique path using various attributes
function getUniquePath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  
  while (current && current !== document.body && parts.length < 4) {
    let part = current.tagName.toLowerCase();
    
    if (current.id) {
      part = `#${CSS.escape(current.id)}`;
      parts.unshift(part);
      break;
    }
    
    // Add distinguishing class
    const significantClass = Array.from(current.classList).find(c => 
      !c.match(/^(flex|grid|block|inline|p-|m-|w-|h-|text-|bg-|border-)/) &&
      c.length > 2
    );
    if (significantClass) {
      part += `.${CSS.escape(significantClass)}`;
    }
    
    parts.unshift(part);
    current = current.parentElement;
  }
  
  return parts.join(' > ');
}

// Extract element info for AI context
function extractElementInfo(element: Element): SelectedElement {
  const { primary, alternatives } = generateSelectors(element);
  const rect = element.getBoundingClientRect();
  
  // Get parent context
  let parentHTML = '';
  if (element.parentElement) {
    const parent = element.parentElement.cloneNode(false) as Element;
    parentHTML = parent.outerHTML.replace('></', '>...</');
  }
  
  // Get sibling info
  const siblings = element.parentElement?.children;
  let siblingInfo = '';
  if (siblings && siblings.length > 1) {
    siblingInfo = `Element is child ${Array.from(siblings).indexOf(element) + 1} of ${siblings.length} siblings`;
  }
  
  // Get attributes
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    attributes[attr.name] = attr.value.substring(0, 100);
  }
  
  // Truncate HTML for context
  let outerHTML = element.outerHTML;
  if (outerHTML.length > 2000) {
    outerHTML = outerHTML.substring(0, 2000) + '... [truncated]';
  }
  
  let innerHTML = element.innerHTML;
  if (innerHTML.length > 1000) {
    innerHTML = innerHTML.substring(0, 1000) + '... [truncated]';
  }
  
  return {
    selector: primary,
    alternativeSelectors: alternatives,
    tagName: element.tagName,
    id: element.id || undefined,
    classes: Array.from(element.classList),
    textContent: element.textContent?.trim().substring(0, 200),
    innerHTML,
    outerHTML,
    attributes,
    boundingRect: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    },
    parentHTML,
    siblingInfo,
  };
}

// Handle mouse move during picking
function handleMouseMove(e: MouseEvent): void {
  if (!isPickerActive) return;
  
  const target = e.target as Element;
  if (!target || target === highlightOverlay || target === infoTooltip) return;
  
  // Ignore our own overlay elements
  if (target.id?.startsWith('quark-')) return;
  
  // Update highlight overlay
  const rect = target.getBoundingClientRect();
  if (highlightOverlay) {
    highlightOverlay.style.display = 'block';
    highlightOverlay.style.top = `${rect.top}px`;
    highlightOverlay.style.left = `${rect.left}px`;
    highlightOverlay.style.width = `${rect.width}px`;
    highlightOverlay.style.height = `${rect.height}px`;
  }
  
  // Update tooltip
  if (infoTooltip) {
    const { primary } = generateSelectors(target);
    infoTooltip.innerHTML = `
      <div style="color: #818cf8; margin-bottom: 4px;">${target.tagName.toLowerCase()}</div>
      <div style="color: #94a3b8; font-size: 11px; word-break: break-all;">${primary}</div>
    `;
    infoTooltip.style.display = 'block';
    
    // Position tooltip
    let tooltipTop = rect.bottom + 10;
    let tooltipLeft = rect.left;
    
    // Keep tooltip in viewport
    if (tooltipTop + 60 > window.innerHeight) {
      tooltipTop = rect.top - 60;
    }
    if (tooltipLeft + 400 > window.innerWidth) {
      tooltipLeft = window.innerWidth - 410;
    }
    
    infoTooltip.style.top = `${tooltipTop}px`;
    infoTooltip.style.left = `${tooltipLeft}px`;
  }
}

// Handle click during picking
function handleClick(e: MouseEvent): void {
  if (!isPickerActive) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  const target = e.target as Element;
  if (!target || target.id?.startsWith('quark-')) return;
  
  // Extract element info
  const elementInfo = extractElementInfo(target);
  
  // Send to background/sidepanel
  chrome.runtime.sendMessage({
    type: 'ELEMENT_SELECTED',
    payload: elementInfo,
  });
  
  // Deactivate picker
  deactivatePicker();
}

// Handle escape key
function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && isPickerActive) {
    deactivatePicker();
    chrome.runtime.sendMessage({
      type: 'ELEMENT_PICKER_CANCELLED',
      payload: {},
    });
  }
}

// Activate the element picker
export function activatePicker(): void {
  if (isPickerActive) return;
  
  isPickerActive = true;
  
  // Create overlay elements if they don't exist
  if (!highlightOverlay) {
    highlightOverlay = createHighlightOverlay();
  }
  if (!infoTooltip) {
    infoTooltip = createInfoTooltip();
  }
  
  // Add event listeners
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  
  // Change cursor
  document.body.style.cursor = 'crosshair';
  
  console.log('[Quark] Element picker activated');
}

// Deactivate the element picker
export function deactivatePicker(): void {
  if (!isPickerActive) return;
  
  isPickerActive = false;
  
  // Remove event listeners
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  
  // Hide overlay elements
  if (highlightOverlay) {
    highlightOverlay.style.display = 'none';
  }
  if (infoTooltip) {
    infoTooltip.style.display = 'none';
  }
  
  // Reset cursor
  document.body.style.cursor = '';
  
  console.log('[Quark] Element picker deactivated');
}

// Check if picker is active
export function isPickerActiveState(): boolean {
  return isPickerActive;
}

