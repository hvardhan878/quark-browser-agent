import { useState, useEffect } from 'react';
import { Target, X, Check, Copy, Code } from 'lucide-react';
import type { SelectedElement } from '../../shared/types';

interface ElementPickerProps {
  onElementSelected: (element: SelectedElement) => void;
  selectedElement: SelectedElement | null;
  onClearSelection: () => void;
}

export function ElementPicker({ onElementSelected, selectedElement, onClearSelection }: ElementPickerProps) {
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [copiedSelector, setCopiedSelector] = useState(false);

  useEffect(() => {
    // Listen for element selection from content script
    const handleMessage = (message: { type: string; payload: unknown }) => {
      if (message.type === 'ELEMENT_SELECTED') {
        const element = message.payload as SelectedElement;
        onElementSelected(element);
        setIsPickerActive(false);
      } else if (message.type === 'ELEMENT_PICKER_CANCELLED') {
        setIsPickerActive(false);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [onElementSelected]);

  const startPicker = async () => {
    try {
      setIsPickerActive(true);
      await chrome.runtime.sendMessage({ type: 'START_ELEMENT_PICKER', payload: {} });
    } catch (error) {
      console.error('Failed to start element picker:', error);
      setIsPickerActive(false);
    }
  };

  const stopPicker = async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'STOP_ELEMENT_PICKER', payload: {} });
      setIsPickerActive(false);
    } catch (error) {
      console.error('Failed to stop element picker:', error);
    }
  };

  const copySelector = () => {
    if (selectedElement) {
      navigator.clipboard.writeText(selectedElement.selector);
      setCopiedSelector(true);
      setTimeout(() => setCopiedSelector(false), 2000);
    }
  };

  return (
    <div className="space-y-3">
      {/* Picker Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={isPickerActive ? stopPicker : startPicker}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
            isPickerActive
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              : 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/20'
          }`}
        >
          <Target size={16} className={isPickerActive ? 'animate-pulse' : ''} />
          {isPickerActive ? 'Click element on page...' : 'Pick Element'}
        </button>
        
        {selectedElement && (
          <button
            onClick={onClearSelection}
            className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            title="Clear selection"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Picker Status */}
      {isPickerActive && (
        <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] rounded-lg p-3">
          <p>📍 Click on any element on the page to select it.</p>
          <p className="mt-1">Press <kbd className="px-1 py-0.5 bg-[var(--bg-secondary)] rounded">Esc</kbd> to cancel.</p>
        </div>
      )}

      {/* Selected Element Display */}
      {selectedElement && (
        <div className="bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-subtle)] overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 bg-[var(--accent-primary)]/10 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check size={14} className="text-green-400" />
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Element Selected
              </span>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              {selectedElement.tagName.toLowerCase()}
            </span>
          </div>

          {/* Selector */}
          <div className="p-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--text-muted)]">Primary Selector</span>
              <button
                onClick={copySelector}
                className="text-xs text-[var(--accent-secondary)] hover:underline flex items-center gap-1"
              >
                {copiedSelector ? <Check size={12} /> : <Copy size={12} />}
                {copiedSelector ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <code className="text-xs text-[var(--accent-primary)] bg-[var(--bg-secondary)] px-2 py-1 rounded block overflow-x-auto">
              {selectedElement.selector}
            </code>
          </div>

          {/* Alternative Selectors */}
          {selectedElement.alternativeSelectors.length > 0 && (
            <div className="p-3 border-b border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)] block mb-2">Alternative Selectors</span>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {selectedElement.alternativeSelectors.slice(0, 4).map((sel, i) => (
                  <code 
                    key={i}
                    className="text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-2 py-1 rounded block overflow-x-auto cursor-pointer hover:bg-[var(--bg-hover)]"
                    onClick={() => navigator.clipboard.writeText(sel)}
                    title="Click to copy"
                  >
                    {sel}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Element Text */}
          {selectedElement.textContent && (
            <div className="p-3 border-b border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)] block mb-1">Text Content</span>
              <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                {selectedElement.textContent}
              </p>
            </div>
          )}

          {/* HTML Preview */}
          <details className="group">
            <summary className="px-3 py-2 text-xs text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-hover)] flex items-center gap-2">
              <Code size={12} />
              View HTML
            </summary>
            <div className="p-3 bg-[var(--bg-secondary)]">
              <pre className="text-xs text-[var(--text-secondary)] overflow-x-auto max-h-40 overflow-y-auto">
                {selectedElement.outerHTML}
              </pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

