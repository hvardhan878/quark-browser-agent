import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Play, Copy, Check, Camera, Target, Image } from 'lucide-react';
import type { SiteContext, ChatMessage, GeneratedScript, SelectedElement, PageSnapshot } from '../../shared/types';
import { generateId } from '../../shared/messaging';
import { ElementPicker } from './ElementPicker';

interface ChatInterfaceProps {
  context: SiteContext | null;
  onScriptGenerated: (script: GeneratedScript) => void;
}

export function ChatInterface({ context, onScriptGenerated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingScript, setPendingScript] = useState<{ code: string; explanation: string } | null>(null);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [pageSnapshot, setPageSnapshot] = useState<PageSnapshot | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Add welcome message
    if (messages.length === 0 && context) {
      setMessages([{
        id: generateId(),
        role: 'assistant',
        content: `Hi! I'm Quark, your AI website assistant. I can help you customize **${context.domain}** by:\n\n• Modifying the UI or hiding elements\n• Intercepting or blocking API calls\n• Adding new features or automations\n• Extracting data from the page\n\nWhat would you like to do?`,
        timestamp: Date.now(),
      }]);
    }
  }, [context, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Capture page snapshot for enhanced context
  const captureSnapshot = async () => {
    setIsCapturingSnapshot(true);
    try {
      const result = await chrome.runtime.sendMessage({ type: 'CAPTURE_SNAPSHOT', payload: {} });
      if (result?.success && result?.snapshot) {
        setPageSnapshot(result.snapshot);
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: '📸 Page snapshot captured! I now have detailed context about the page structure.',
          timestamp: Date.now(),
        }]);
      }
    } catch (error) {
      console.error('Failed to capture snapshot:', error);
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  // Capture screenshot for vision models
  const captureScreenshot = async () => {
    setIsCapturingScreenshot(true);
    try {
      const result = await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT', payload: {} });
      if (result?.success && result?.screenshot) {
        setScreenshot(result.screenshot);
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: '🖼️ Screenshot captured! I can now see what the page looks like (requires vision-capable model).',
          timestamp: Date.now(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: `❌ Failed to capture screenshot: ${result?.error || 'Unknown error'}`,
          timestamp: Date.now(),
        }]);
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !context) return;

    // Build enhanced context with selected element, snapshot, and screenshot
    const enhancedContext = {
      ...context,
      selectedElement: selectedElement ?? undefined,
      pageSnapshot: pageSnapshot ?? undefined,
      screenshot: screenshot ?? undefined,
    };

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setPendingScript(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_SCRIPT',
        payload: { prompt: userMessage.content, context: enhancedContext },
      });

      if (response.error) {
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: `❌ Error: ${response.error}`,
          timestamp: Date.now(),
        }]);
      } else if (response.script) {
        const script = response.script as GeneratedScript;
        onScriptGenerated(script);

        setPendingScript({
          code: script.code,
          explanation: response.explanation ?? script.description,
        });

        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: response.explanation ?? `Generated script: **${script.name}**\n\n${script.description}`,
          timestamp: Date.now(),
          scriptId: script.id,
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `❌ Failed to generate script: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const executeScript = async (code: string) => {
    console.log('[Quark] executeScript called');
    
    try {
      console.log('[Quark] Querying for active tab...');
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('[Quark] Tabs found:', tabs);
      
      const tab = tabs[0];
      
      if (!tab?.id) {
        console.error('[Quark] No active tab found');
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: '❌ Could not find active tab. Make sure you have a webpage open.',
          timestamp: Date.now(),
        }]);
        return;
      }

      console.log('[Quark] Sending INJECT_SCRIPT to tab:', tab.id, 'URL:', tab.url);
      
      const result = await chrome.runtime.sendMessage({
        type: 'INJECT_SCRIPT',
        payload: { code, tabId: tab.id },
      });

      console.log('[Quark] Script execution result:', result);

      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: result?.success 
          ? '✅ Script executed successfully!' 
          : `❌ Execution failed: ${result?.error ?? 'Unknown error'}`,
        timestamp: Date.now(),
      }]);
    } catch (err) {
      console.error('[Quark] Script execution error:', err);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `❌ Failed to execute: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: Date.now(),
      }]);
    }
  };

  if (!context) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
          <Loader2 className="w-8 h-8 text-[var(--text-muted)] animate-spin" />
        </div>
        <p className="text-[var(--text-secondary)]">Loading site context...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Pending script preview */}
        {pendingScript && (
          <div className="animate-fade-in">
            <CodePreview 
              code={pendingScript.code} 
              onExecute={() => executeScript(pendingScript.code)}
            />
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Generating script...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Tools Panel */}
      {showTools && (
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Context Tools</h3>
            <button
              onClick={() => setShowTools(false)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Hide
            </button>
          </div>
          
          {/* Element Picker */}
          <ElementPicker
            onElementSelected={setSelectedElement}
            selectedElement={selectedElement}
            onClearSelection={() => setSelectedElement(null)}
          />
          
          {/* Snapshot Capture */}
          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <div className="flex gap-2">
              <button
                onClick={captureSnapshot}
                disabled={isCapturingSnapshot}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors disabled:opacity-50"
              >
                {isCapturingSnapshot ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Camera size={16} />
                )}
                {isCapturingSnapshot ? 'Capturing...' : 'Snapshot'}
              </button>
              <button
                onClick={captureScreenshot}
                disabled={isCapturingScreenshot}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors disabled:opacity-50"
                title="Capture screenshot for vision models (GPT-4o, Claude)"
              >
                {isCapturingScreenshot ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Image size={16} />
                )}
                {isCapturingScreenshot ? 'Capturing...' : 'Screenshot'}
              </button>
            </div>
            <div className="flex flex-col gap-1 mt-2">
              {pageSnapshot && (
                <p className="text-xs text-green-400 text-center">
                  ✓ Snapshot: {pageSnapshot.interactiveElements.length} elements
                </p>
              )}
              {screenshot && (
                <p className="text-xs text-blue-400 text-center">
                  ✓ Screenshot ready for vision models
                </p>
              )}
            </div>
          </div>

          {/* Context Status */}
          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <p className="text-xs text-[var(--text-muted)]">
              <span className="font-medium">Active Context:</span>
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedElement && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-xs rounded">
                  <Target size={10} />
                  Element selected
                </span>
              )}
              {pageSnapshot && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                  <Camera size={10} />
                  Snapshot ready
                </span>
              )}
              {screenshot && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                  <Image size={10} />
                  Screenshot ready
                </span>
              )}
              {!selectedElement && !pageSnapshot && !screenshot && (
                <span className="text-xs text-[var(--text-muted)]">
                  No enhanced context. Pick an element, capture a snapshot, or take a screenshot.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-[var(--border-color)]">
        {/* Tools Toggle */}
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => setShowTools(!showTools)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
              showTools || selectedElement || pageSnapshot
                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Target size={12} />
            Tools
            {(selectedElement || pageSnapshot) && (
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            )}
          </button>
          
          {selectedElement && (
            <span className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">
              📍 {selectedElement.tagName.toLowerCase()}
              {selectedElement.id ? `#${selectedElement.id}` : ''}
            </span>
          )}
        </div>

        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedElement 
              ? `Describe what to do with the selected ${selectedElement.tagName.toLowerCase()}...`
              : "Describe what you want to do..."
            }
            className="input-field w-full resize-none pr-12"
            rows={2}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 bottom-2 p-2 rounded-lg bg-[var(--accent-primary)] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--accent-secondary)] transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser ? 'message-user' : 'message-assistant'
        }`}
      >
        <div 
          className="text-sm whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ 
            __html: formatMessage(message.content) 
          }}
        />
      </div>
    </div>
  );
}

function formatMessage(content: string): string {
  // Simple markdown-like formatting
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-black/20 px-1 rounded">$1</code>')
    .replace(/\n/g, '<br/>');
}

function CodePreview({ code, onExecute }: { code: string; onExecute: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--text-secondary)]">Generated Code</span>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Copy code"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-[var(--text-muted)]" />}
          </button>
          <button
            onClick={onExecute}
            className="flex items-center gap-1.5 px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Play size={12} />
            Run
          </button>
        </div>
      </div>
      <pre className="code-block text-xs max-h-[200px] overflow-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

