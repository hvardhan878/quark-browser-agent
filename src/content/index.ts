import { DOMAnalyzer } from './dom-analyzer';
import type { ExtensionMessage } from '../shared/types';

const domAnalyzer = new DOMAnalyzer();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case 'ANALYZE_DOM': {
      const analysis = domAnalyzer.analyze();
      
      // Send analysis to background
      const domain = window.location.hostname;
      chrome.runtime.sendMessage({
        type: 'DOM_ANALYSIS_RESULT',
        payload: { domain, analysis },
      });
      
      return analysis;
    }
    
    case 'INJECT_SCRIPT': {
      const { code } = message.payload as { code: string };
      return executeScript(code);
    }
    
    default:
      return { error: 'Unknown message type' };
  }
}

function executeScript(code: string): { success: boolean; result?: unknown; error?: string } {
  try {
    // Create script element to run in page context
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        try {
          ${code}
        } catch (e) {
          console.error('[Quark] Script error:', e);
        }
      })();
    `;
    
    document.documentElement.appendChild(script);
    script.remove();
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Auto-analyze DOM when page loads
function initializeAnalysis(): void {
  // Wait for page to be fully loaded
  if (document.readyState === 'complete') {
    performAnalysis();
  } else {
    window.addEventListener('load', performAnalysis);
  }
}

function performAnalysis(): void {
  // Delay slightly to let dynamic content load
  setTimeout(() => {
    const analysis = domAnalyzer.analyze();
    const domain = window.location.hostname;
    
    chrome.runtime.sendMessage({
      type: 'DOM_ANALYSIS_RESULT',
      payload: { domain, analysis },
    }).catch(() => {
      // Extension context might not be ready
    });
  }, 1000);
}

// Initialize
initializeAnalysis();

// Re-analyze on major DOM changes
const observer = new MutationObserver((mutations) => {
  // Only re-analyze if significant changes occurred
  const significantChange = mutations.some(m => 
    m.addedNodes.length > 5 || 
    m.removedNodes.length > 5 ||
    (m.type === 'childList' && m.target.nodeName === 'BODY')
  );
  
  if (significantChange) {
    performAnalysis();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

console.log('[Quark] Content script loaded');

