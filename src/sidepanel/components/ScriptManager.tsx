import { useState } from 'react';
import { Play, Pause, Trash2, Edit2, Copy, Check, Download, Code } from 'lucide-react';
import type { GeneratedScript } from '../../shared/types';
import { deleteScript, saveScript } from '../../shared/storage';
import { buildTampermonkeyPrompt } from '../../lib/prompt-templates';

interface ScriptManagerProps {
  scripts: GeneratedScript[];
  domain: string;
  onScriptUpdated: (script: GeneratedScript) => void;
  onScriptDeleted: (scriptId: string) => void;
}

export function ScriptManager({ scripts, domain, onScriptUpdated, onScriptDeleted }: ScriptManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');

  const handleToggleEnabled = async (script: GeneratedScript) => {
    const updated = { ...script, enabled: !script.enabled, updatedAt: Date.now() };
    await saveScript(updated);
    onScriptUpdated(updated);
  };

  const handleDelete = async (scriptId: string) => {
    if (confirm('Are you sure you want to delete this script?')) {
      await deleteScript(domain, scriptId);
      onScriptDeleted(scriptId);
    }
  };

  const handleEdit = (script: GeneratedScript) => {
    setEditingId(script.id);
    setEditCode(script.code);
  };

  const handleSaveEdit = async (script: GeneratedScript) => {
    const updated = { ...script, code: editCode, updatedAt: Date.now() };
    await saveScript(updated);
    onScriptUpdated(updated);
    setEditingId(null);
  };

  const handleRun = async (code: string) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      await chrome.runtime.sendMessage({
        type: 'INJECT_SCRIPT',
        payload: { code, tabId: tab.id },
      });
    } catch (err) {
      console.error('Failed to run script:', err);
    }
  };

  const handleExportTampermonkey = (script: GeneratedScript) => {
    const userscript = buildTampermonkeyPrompt({
      name: script.name,
      description: script.description,
      code: script.code,
      domain: script.domain,
    });

    const blob = new Blob([userscript], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.name.replace(/\s+/g, '-').toLowerCase()}.user.js`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (scripts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <Code className="w-12 h-12 text-[var(--text-muted)] mb-4" />
        <p className="text-[var(--text-secondary)] text-center">
          No scripts yet
        </p>
        <p className="text-[var(--text-muted)] text-xs text-center mt-2">
          Use the chat to generate scripts for this site
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border-color)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Scripts for {domain}
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {scripts.length} script{scripts.length !== 1 ? 's' : ''} saved
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {scripts.map((script) => (
          <ScriptCard
            key={script.id}
            script={script}
            isEditing={editingId === script.id}
            editCode={editCode}
            onEditCodeChange={setEditCode}
            onToggleEnabled={() => handleToggleEnabled(script)}
            onDelete={() => handleDelete(script.id)}
            onEdit={() => handleEdit(script)}
            onSaveEdit={() => handleSaveEdit(script)}
            onCancelEdit={() => setEditingId(null)}
            onRun={() => handleRun(script.code)}
            onExport={() => handleExportTampermonkey(script)}
          />
        ))}
      </div>
    </div>
  );
}

interface ScriptCardProps {
  script: GeneratedScript;
  isEditing: boolean;
  editCode: string;
  onEditCodeChange: (code: string) => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRun: () => void;
  onExport: () => void;
}

function ScriptCard({
  script,
  isEditing,
  editCode,
  onEditCodeChange,
  onToggleEnabled,
  onDelete,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onRun,
  onExport,
}: ScriptCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(script.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">
            {script.name}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">
            {script.description}
          </p>
        </div>
        <button
          onClick={onToggleEnabled}
          className={`ml-2 p-1.5 rounded-lg transition-colors ${
            script.enabled 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
          }`}
        >
          {script.enabled ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </div>

      {/* Prompt used */}
      <div className="mb-3 p-2 bg-[var(--bg-primary)] rounded text-xs text-[var(--text-secondary)]">
        <span className="text-[var(--text-muted)]">Prompt:</span> {script.prompt}
      </div>

      {/* Code preview/editor */}
      {isEditing ? (
        <div className="mb-3">
          <textarea
            value={editCode}
            onChange={(e) => onEditCodeChange(e.target.value)}
            className="w-full h-40 font-mono text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-3 text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent-primary)]"
          />
          <div className="flex gap-2 mt-2">
            <button onClick={onSaveEdit} className="btn-primary text-xs">
              Save
            </button>
            <button onClick={onCancelEdit} className="btn-secondary text-xs">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <pre className="code-block text-xs max-h-[100px] overflow-auto mb-3">
          <code>{script.code.substring(0, 300)}{script.code.length > 300 ? '...' : ''}</code>
        </pre>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-color)]">
        <button
          onClick={onRun}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
        >
          <Play size={12} />
          Run
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] transition-colors"
          title="Edit"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] transition-colors"
          title="Copy"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
        <button
          onClick={onExport}
          className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] transition-colors"
          title="Export as Tampermonkey"
        >
          <Download size={14} />
        </button>
        <div className="flex-1" />
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-400 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
        <span>Model: {script.model}</span>
        <span>Updated: {new Date(script.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

