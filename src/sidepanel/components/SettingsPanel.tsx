import { useState, useEffect } from 'react';
import { Key, Save, Download, Trash2, Check, AlertCircle } from 'lucide-react';
import type { OpenRouterConfig, SiteContext, GeneratedScript } from '../../shared/types';
import { getConfig, setConfig, clearAllData } from '../../shared/storage';
import { buildExportDocumentation } from '../../lib/prompt-templates';

interface SettingsPanelProps {
  context: SiteContext | null;
  scripts: GeneratedScript[];
}

const POPULAR_MODELS = [
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5 (Recommended)' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large' },
];

export function SettingsPanel({ context, scripts }: SettingsPanelProps) {
  const [config, setLocalConfig] = useState<OpenRouterConfig>({
    apiKey: '',
    model: 'anthropic/claude-sonnet-4',
    temperature: 0.7,
    maxTokens: 4096,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const loaded = await getConfig();
    setLocalConfig(loaded);
  };

  const handleSave = async () => {
    try {
      setError(null);
      await setConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  const handleExportDocumentation = () => {
    if (!context) return;

    const doc = buildExportDocumentation(context, scripts);
    const blob = new Blob([doc], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${context.domain}-analysis.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearData = async () => {
    if (confirm('Are you sure you want to clear all data? This will delete all scripts, conversations, and settings.')) {
      await clearAllData();
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* API Key Section */}
        <section className="card">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Key size={16} />
            OpenRouter API Key
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={config.apiKey}
                  onChange={(e) => setLocalConfig({ ...config, apiKey: e.target.value })}
                  placeholder="sk-or-v1-..."
                  className="input-field w-full pr-20"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Get your API key from{' '}
                <a 
                  href="https://openrouter.ai/keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[var(--accent-secondary)] hover:underline"
                >
                  openrouter.ai/keys
                </a>
              </p>
            </div>

            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">
                Model
              </label>
              <select
                value={config.model}
                onChange={(e) => setLocalConfig({ ...config, model: e.target.value })}
                className="input-field w-full"
              >
                {POPULAR_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">
                  Temperature
                </label>
                <input
                  type="number"
                  value={config.temperature}
                  onChange={(e) => setLocalConfig({ ...config, temperature: parseFloat(e.target.value) })}
                  min="0"
                  max="2"
                  step="0.1"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={config.maxTokens}
                  onChange={(e) => setLocalConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                  min="100"
                  max="128000"
                  step="100"
                  className="input-field w-full"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              onClick={handleSave}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {saved ? (
                <>
                  <Check size={16} />
                  Saved!
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </section>

        {/* Export Section */}
        <section className="card">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Download size={16} />
            Export for Development
          </h3>
          
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Export discovered APIs and generated scripts as documentation for your development team.
          </p>

          <button
            onClick={handleExportDocumentation}
            disabled={!context}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Export Documentation
          </button>

          {context && (
            <div className="mt-3 text-xs text-[var(--text-muted)]">
              <p>Will include:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>{context.apis.reduce((sum, cat) => sum + cat.endpoints.length, 0)} API endpoints</li>
                <li>{scripts.length} generated scripts</li>
                <li>DOM structure summary</li>
              </ul>
            </div>
          )}
        </section>

        {/* Danger Zone */}
        <section className="card border-red-500/30">
          <h3 className="text-sm font-semibold text-red-400 mb-4 flex items-center gap-2">
            <Trash2 size={16} />
            Danger Zone
          </h3>
          
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Clear all stored data including scripts, conversations, and settings.
          </p>

          <button
            onClick={handleClearData}
            className="w-full px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors"
          >
            Clear All Data
          </button>
        </section>

        {/* About */}
        <section className="text-center text-xs text-[var(--text-muted)] py-4">
          <p>Quark Browser Agent v0.1.0</p>
          <p className="mt-1">AI-powered website customization</p>
        </section>
      </div>
    </div>
  );
}

