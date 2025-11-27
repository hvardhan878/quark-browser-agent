// Script injection utilities for content script

export interface InjectionResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

// Inject and execute script in page context
export function injectScript(code: string): InjectionResult {
  try {
    const script = document.createElement('script');
    script.textContent = wrapScript(code);
    document.documentElement.appendChild(script);
    script.remove();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Inject script from URL
export function injectScriptFromUrl(url: string): Promise<InjectionResult> {
  return new Promise((resolve) => {
    try {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => {
        script.remove();
        resolve({ success: true });
      };
      script.onerror = () => {
        script.remove();
        resolve({ success: false, error: `Failed to load script from ${url}` });
      };
      document.documentElement.appendChild(script);
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

// Inject CSS
export function injectCSS(css: string): InjectionResult {
  try {
    const style = document.createElement('style');
    style.textContent = css;
    style.setAttribute('data-quark', 'true');
    document.head.appendChild(style);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Remove injected CSS
export function removeInjectedCSS(): void {
  const styles = document.querySelectorAll('style[data-quark]');
  styles.forEach(style => style.remove());
}

// Wrap script in IIFE with error handling
function wrapScript(code: string): string {
  return `
(function() {
  'use strict';
  try {
    ${code}
  } catch (error) {
    console.error('[Quark] Script execution error:', error);
  }
})();
`;
}

// Execute script with return value (using postMessage)
export function executeWithResult(code: string): Promise<InjectionResult> {
  return new Promise((resolve) => {
    const messageId = `quark-${Date.now()}-${Math.random()}`;
    
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'quark-result' && event.data?.id === messageId) {
        window.removeEventListener('message', handler);
        resolve(event.data.result);
      }
    };
    
    window.addEventListener('message', handler);
    
    // Timeout after 10 seconds
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve({ success: false, error: 'Script execution timeout' });
    }, 10000);
    
    const wrappedCode = `
(function() {
  'use strict';
  try {
    const result = (function() {
      ${code}
    })();
    window.postMessage({
      type: 'quark-result',
      id: '${messageId}',
      result: { success: true, result: result }
    }, '*');
  } catch (error) {
    window.postMessage({
      type: 'quark-result',
      id: '${messageId}',
      result: { success: false, error: error.message || String(error) }
    }, '*');
  }
})();
`;
    
    const script = document.createElement('script');
    script.textContent = wrappedCode;
    document.documentElement.appendChild(script);
    script.remove();
  });
}

// Intercept fetch requests
export function interceptFetch(handler: (url: string, options: RequestInit) => RequestInit | null): void {
  const code = `
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
      const handler = ${handler.toString()};
      const modified = handler(url, options);
      if (modified === null) {
        return Promise.resolve(new Response('', { status: 204 }));
      }
      return originalFetch.call(this, url, modified || options);
    };
  `;
  injectScript(code);
}

// Intercept XMLHttpRequest
export function interceptXHR(handler: (method: string, url: string) => boolean): void {
  const code = `
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      const handler = ${handler.toString()};
      if (handler(method, url) === false) {
        this._blocked = true;
        return;
      }
      return originalOpen.call(this, method, url, ...args);
    };
    
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...args) {
      if (this._blocked) return;
      return originalSend.call(this, ...args);
    };
  `;
  injectScript(code);
}

