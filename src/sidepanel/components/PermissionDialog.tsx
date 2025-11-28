import { AlertTriangle, Check, X, Code, Globe } from 'lucide-react';
import type { PermissionRequest } from '../../shared/types';

interface PermissionDialogProps {
  request: PermissionRequest;
  onApprove: () => void;
  onDeny: () => void;
}

export function PermissionDialog({ request, onApprove, onDeny }: PermissionDialogProps) {
  const getIcon = () => {
    switch (request.toolName) {
      case 'inject_script':
        return <Code size={24} className="text-orange-400" />;
      case 'call_api':
        return <Globe size={24} className="text-blue-400" />;
      default:
        return <AlertTriangle size={24} className="text-yellow-400" />;
    }
  };

  const getTitle = () => {
    switch (request.toolName) {
      case 'inject_script':
        return 'Run Script?';
      case 'call_api':
        return 'Make API Call?';
      default:
        return 'Permission Required';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] max-w-md w-full shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-[var(--border-color)]">
          <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]">
            {getIcon()}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              {getTitle()}
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              The agent wants to perform an action
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-[var(--text-primary)]">
            {request.description}
          </p>

          {/* Show code preview for inject_script */}
          {request.toolName === 'inject_script' && typeof request.toolParams.code === 'string' && (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-2">Code to execute:</p>
              <pre className="text-xs bg-[var(--bg-primary)] p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto border border-[var(--border-subtle)]">
                <code className="text-[var(--text-secondary)]">
                  {request.toolParams.code.substring(0, 500)}
                  {request.toolParams.code.length > 500 ? '\n... [truncated]' : ''}
                </code>
              </pre>
            </div>
          )}

          {/* Show API details for call_api */}
          {request.toolName === 'call_api' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                  {String(request.toolParams.method)}
                </span>
                <span className="text-xs text-[var(--text-secondary)] truncate">
                  {String(request.toolParams.url)}
                </span>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-200">
              {request.toolName === 'inject_script'
                ? 'This will execute JavaScript code on the current page. Only approve if you trust the action.'
                : 'This will make an HTTP request to an external server.'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-[var(--border-color)]">
          <button
            onClick={onDeny}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <X size={16} />
            Deny
          </button>
          <button
            onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors"
          >
            <Check size={16} />
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

