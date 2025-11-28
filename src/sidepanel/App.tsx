import React, { useState, useEffect, useCallback } from 'react';
import { Settings, MessageSquare, Code, Database } from 'lucide-react';
import { ChatInterface } from './components/ChatInterface';
import { ApiExplorer } from './components/ApiExplorer';
import { ScriptManager } from './components/ScriptManager';
import { SettingsPanel } from './components/SettingsPanel';
import { useSiteContext } from './hooks/useSiteContext';
import type { GeneratedScript, AgentState } from '../shared/types';

type Tab = 'chat' | 'apis' | 'scripts' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const { context, loading, error, refresh } = useSiteContext();
  const [scripts, setScripts] = useState<GeneratedScript[]>([]);

  const loadScripts = useCallback(async (domain: string) => {
    try {
      const result = await chrome.storage.local.get('scripts');
      const allScripts = result.scripts ?? {};
      setScripts(allScripts[domain] ?? []);
    } catch (err) {
      console.error('Failed to load scripts:', err);
    }
  }, []);

  useEffect(() => {
    // Load scripts for current domain
    if (context?.domain) {
      loadScripts(context.domain);
    }
  }, [context?.domain, loadScripts]);

  // Listen for agent state updates to reload scripts when new ones are saved
  useEffect(() => {
    const handleMessage = (message: { type: string; payload: unknown }) => {
      if (message.type === 'AGENT_STATE_UPDATE') {
        const state = message.payload as AgentState;
        // Reload scripts when agent completes or has a new script
        if (state.activeScriptId && context?.domain) {
          console.log('[Quark App] Agent has new script, reloading scripts');
          loadScripts(context.domain);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [context?.domain, loadScripts]);

  const handleScriptGenerated = (script: GeneratedScript) => {
    setScripts(prev => {
      // Check if script already exists (avoid duplicates)
      if (prev.some(s => s.id === script.id)) {
        return prev.map(s => s.id === script.id ? script : s);
      }
      return [...prev, script];
    });
  };

  const handleScriptUpdated = (updatedScript: GeneratedScript) => {
    setScripts(prev => prev.map(s => s.id === updatedScript.id ? updatedScript : s));
  };

  const handleScriptDeleted = (scriptId: string) => {
    setScripts(prev => prev.filter(s => s.id !== scriptId));
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">Q</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[var(--text-primary)]">Quark</h1>
            <p className="text-xs text-[var(--text-muted)] truncate max-w-[150px]">
              {context?.domain ?? 'No site'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {loading && <div className="spinner" />}
          {context && (
            <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-2 py-1 rounded">
              {context.apis.reduce((sum, cat) => sum + cat.endpoints.length, 0)} APIs
            </span>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="flex border-b border-[var(--border-color)]">
        <TabButton 
          active={activeTab === 'chat'} 
          onClick={() => setActiveTab('chat')}
          icon={<MessageSquare size={16} />}
          label="Chat"
        />
        <TabButton 
          active={activeTab === 'apis'} 
          onClick={() => setActiveTab('apis')}
          icon={<Database size={16} />}
          label="APIs"
        />
        <TabButton 
          active={activeTab === 'scripts'} 
          onClick={() => setActiveTab('scripts')}
          icon={<Code size={16} />}
          label="Scripts"
          badge={scripts.length > 0 ? scripts.length : undefined}
        />
        <TabButton 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')}
          icon={<Settings size={16} />}
          label="Settings"
        />
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {error && (
          <div className="m-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        
        {activeTab === 'chat' && (
          <ChatInterface 
            context={context}
            scripts={scripts}
            onScriptGenerated={handleScriptGenerated}
          />
        )}
        {activeTab === 'apis' && (
          <ApiExplorer 
            context={context} 
            onRefresh={refresh}
          />
        )}
        {activeTab === 'scripts' && (
          <ScriptManager 
            scripts={scripts}
            domain={context?.domain ?? ''}
            onScriptUpdated={handleScriptUpdated}
            onScriptDeleted={handleScriptDeleted}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsPanel context={context} scripts={scripts} />
        )}
      </main>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

function TabButton({ active, onClick, icon, label, badge }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all relative
        ${active 
          ? 'text-[var(--accent-secondary)] border-b-2 border-[var(--accent-primary)]' 
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-b-2 border-transparent'
        }`}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-[var(--accent-primary)] text-white text-[10px] rounded-full px-1">
          {badge}
        </span>
      )}
    </button>
  );
}

