import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Play, Copy, Check, Camera, Target, Image, Bot, ChevronDown, FileCode } from 'lucide-react';
import type { 
  SiteContext, 
  GeneratedScript, 
  SelectedElement, 
  PageSnapshot,
  AgentState,
  AgentMessage,
  PermissionRequest
} from '../../shared/types';
import { ElementPicker } from './ElementPicker';
import { AgentTaskList } from './AgentTaskList';
import { PermissionDialog } from './PermissionDialog';
import { getConfig, setConfig } from '../../shared/storage';

// Popular models for the dropdown
const POPULAR_MODELS = [
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'google/gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
];

interface ChatInterfaceProps {
  context: SiteContext | null;
  scripts: GeneratedScript[];
  onScriptGenerated?: (script: GeneratedScript) => void;
}

export function ChatInterface({ context, scripts }: ChatInterfaceProps) {
  // Agent state
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);
  
  // UI state
  const [input, setInput] = useState('');
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [pageSnapshot, setPageSnapshot] = useState<PageSnapshot | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  
  // Model and script selection
  const [currentModel, setCurrentModel] = useState('anthropic/claude-sonnet-4');
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showScriptSelector, setShowScriptSelector] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load config and conversation on mount
  useEffect(() => {
    const init = async () => {
      const config = await getConfig();
      setCurrentModel(config.model);
      
      // Try to get existing agent state
      const result = await chrome.runtime.sendMessage({ 
        type: 'GET_AGENT_STATE', 
        payload: {} 
      });
      if (result?.state) {
        setAgentState(result.state);
      }
    };
    init();
  }, []);

  // Listen for agent updates
  useEffect(() => {
    const handleMessage = (message: { type: string; payload: unknown }) => {
      if (message.type === 'AGENT_STATE_UPDATE') {
        const state = message.payload as AgentState;
        setAgentState(state);
        
        // Check if a new script was generated
        if (state.activeScriptId) {
          setActiveScriptId(state.activeScriptId);
        }
      } else if (message.type === 'AGENT_PERMISSION_REQUEST') {
        setPermissionRequest(message.payload as PermissionRequest);
      } else if (message.type === 'ELEMENT_SELECTED') {
        setSelectedElement(message.payload as SelectedElement);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentState?.messages]);

  // Get display messages from agent state
  const displayMessages = agentState?.messages.filter(m => 
    m.role === 'user' || (m.role === 'assistant' && m.content)
  ) || [];

  // Check if agent is running
  const isLoading = agentState?.status === 'running';

  // Get active script
  const activeScript = activeScriptId 
    ? scripts.find(s => s.id === activeScriptId)
    : null;

  // Handle model change
  const handleModelChange = async (model: string) => {
    setCurrentModel(model);
    await setConfig({ model });
    setShowModelSelector(false);
  };

  // Handle script selection
  const handleScriptSelect = (scriptId: string | null) => {
    setActiveScriptId(scriptId);
    setShowScriptSelector(false);
  };

  // Capture page snapshot
  const captureSnapshot = async () => {
    setIsCapturingSnapshot(true);
    try {
      const result = await chrome.runtime.sendMessage({ type: 'CAPTURE_SNAPSHOT', payload: {} });
      if (result?.success && result?.snapshot) {
        setPageSnapshot(result.snapshot);
      }
    } catch (error) {
      console.error('Failed to capture snapshot:', error);
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  // Capture screenshot
  const captureScreenshot = async () => {
    setIsCapturingScreenshot(true);
    try {
      const result = await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT', payload: {} });
      if (result?.success && result?.screenshot) {
        setScreenshot(result.screenshot);
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !context) return;

    const userMessage = input.trim();
    setInput('');

    try {
      // Start agent
      await chrome.runtime.sendMessage({
        type: 'AGENT_START',
        payload: { 
          userMessage,
          activeScriptId: activeScriptId ?? undefined,
        },
      });
    } catch (err) {
      console.error('Failed to start agent:', err);
    }
  };

  // Handle permission response
  const handlePermissionResponse = async (approved: boolean) => {
    if (!permissionRequest) return;
    
    await chrome.runtime.sendMessage({
      type: 'AGENT_PERMISSION_RESPONSE',
      payload: { requestId: permissionRequest.id, approved },
    });
    
    setPermissionRequest(null);
  };

  // Execute script manually
  const executeScript = async (code: string) => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      if (!tab?.id) return;

      const result = await chrome.runtime.sendMessage({
        type: 'INJECT_SCRIPT',
        payload: { code, tabId: tab.id },
      });

      console.log('Script execution result:', result);
    } catch (err) {
      console.error('Script execution error:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
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
      {/* Header with model and script selector */}
      <div className="px-4 py-2 border-b border-[var(--border-color)] flex items-center gap-2">
        {/* Model Selector */}
        <div className="relative">
          <button
            onClick={() => setShowModelSelector(!showModelSelector)}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <Bot size={12} />
            {POPULAR_MODELS.find(m => m.id === currentModel)?.name || currentModel.split('/')[1]}
            <ChevronDown size={12} />
          </button>
          
          {showModelSelector && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-lg z-10 overflow-hidden">
              {POPULAR_MODELS.map(model => (
                <button
                  key={model.id}
                  onClick={() => handleModelChange(model.id)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] transition-colors ${
                    currentModel === model.id ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {model.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Script Selector */}
        {scripts.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowScriptSelector(!showScriptSelector)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                activeScript
                  ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                  : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
              }`}
            >
              <FileCode size={12} />
              {activeScript ? activeScript.name.substring(0, 20) : 'New script'}
              <ChevronDown size={12} />
            </button>
            
            {showScriptSelector && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-lg z-10 overflow-hidden max-h-64 overflow-y-auto">
                <button
                  onClick={() => handleScriptSelect(null)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] transition-colors ${
                    !activeScriptId ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  ✨ New script
                </button>
                <div className="border-t border-[var(--border-subtle)]" />
                {scripts.map(script => (
                  <button
                    key={script.id}
                    onClick={() => handleScriptSelect(script.id)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] transition-colors ${
                      activeScriptId === script.id ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="font-medium truncate">{script.name}</div>
                    <div className="text-[var(--text-muted)] truncate">{script.prompt}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome message if no conversation */}
        {displayMessages.length === 0 && !isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-2.5 message-assistant">
              <div className="text-sm whitespace-pre-wrap">
                Hi! I'm Quark, your AI website assistant. I can help you customize <strong>{context.domain}</strong> by:
                <br/><br/>
                • Modifying the UI or hiding elements<br/>
                • Intercepting or blocking API calls<br/>
                • Adding new features or automations<br/>
                • Extracting data from the page
                <br/><br/>
                {activeScript ? (
                  <>Currently editing: <strong>{activeScript.name}</strong></>
                ) : (
                  <>What would you like to do?</>
                )}
              </div>
            </div>
          </div>
        )}

        {displayMessages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Agent Task List */}
        {agentState && agentState.tasks.length > 0 && (
          <AgentTaskList 
            tasks={agentState.tasks} 
            currentTaskId={agentState.currentTaskId}
          />
        )}

        {/* Code preview if script was generated */}
        {agentState?.status === 'completed' && agentState.activeScriptId && (
          <CodePreviewFromScript 
            scriptId={agentState.activeScriptId}
            scripts={scripts}
            onExecute={executeScript}
          />
        )}

        {isLoading && agentState?.tasks.length === 0 && (
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Agent is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Permission Dialog */}
      {permissionRequest && (
        <PermissionDialog
          request={permissionRequest}
          onApprove={() => handlePermissionResponse(true)}
          onDeny={() => handlePermissionResponse(false)}
        />
      )}

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
          
          <ElementPicker
            onElementSelected={setSelectedElement}
            selectedElement={selectedElement}
            onClearSelection={() => setSelectedElement(null)}
          />
          
          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <div className="flex gap-2">
              <button
                onClick={captureSnapshot}
                disabled={isCapturingSnapshot}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors disabled:opacity-50"
              >
                {isCapturingSnapshot ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                {isCapturingSnapshot ? 'Capturing...' : 'Snapshot'}
              </button>
              <button
                onClick={captureScreenshot}
                disabled={isCapturingScreenshot}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors disabled:opacity-50"
              >
                {isCapturingScreenshot ? <Loader2 size={16} className="animate-spin" /> : <Image size={16} />}
                {isCapturingScreenshot ? 'Capturing...' : 'Screenshot'}
              </button>
            </div>
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
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-[var(--border-color)]">
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
            placeholder={
              activeScript 
                ? `How should I modify "${activeScript.name}"?`
                : selectedElement 
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

function MessageBubble({ message }: { message: AgentMessage }) {
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
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-black/20 px-1 rounded">$1</code>')
    .replace(/```(?:javascript|js)?\n([\s\S]*?)```/g, '<pre class="bg-black/20 p-2 rounded mt-2 overflow-x-auto text-xs"><code>$1</code></pre>')
    .replace(/\n/g, '<br/>');
}

function CodePreviewFromScript({ 
  scriptId, 
  scripts,
  onExecute 
}: { 
  scriptId: string;
  scripts: GeneratedScript[];
  onExecute: (code: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const script = scripts.find(s => s.id === scriptId);
  
  if (!script) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(script.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          Generated: {script.name}
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Copy code"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-[var(--text-muted)]" />}
          </button>
          <button
            onClick={() => onExecute(script.code)}
            className="flex items-center gap-1.5 px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Play size={12} />
            Run
          </button>
        </div>
      </div>
      <pre className="code-block text-xs max-h-[200px] overflow-auto">
        <code>{script.code}</code>
      </pre>
    </div>
  );
}
