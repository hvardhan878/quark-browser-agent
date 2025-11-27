import { useState } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Globe, Lock, Key, Cookie } from 'lucide-react';
import type { SiteContext, APICategory, APIEndpoint } from '../../shared/types';

interface ApiExplorerProps {
  context: SiteContext | null;
  onRefresh: () => Promise<void>;
}

export function ApiExplorer({ context, onRefresh }: ApiExplorerProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  if (!context) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <Globe className="w-12 h-12 text-[var(--text-muted)] mb-4" />
        <p className="text-[var(--text-secondary)] text-center">
          Navigate to a website to see discovered APIs
        </p>
      </div>
    );
  }

  const totalEndpoints = context.apis.reduce((sum, cat) => sum + cat.endpoints.length, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Discovered APIs
          </h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <RefreshCw 
              size={16} 
              className={`text-[var(--text-secondary)] ${refreshing ? 'animate-spin' : ''}`} 
            />
          </button>
        </div>
        <div className="flex gap-4 text-xs text-[var(--text-muted)]">
          <span>{context.apis.length} categories</span>
          <span>{totalEndpoints} endpoints</span>
        </div>
      </div>

      {/* API List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {context.apis.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--text-secondary)] text-sm">
              No APIs discovered yet
            </p>
            <p className="text-[var(--text-muted)] text-xs mt-2">
              Interact with the page to capture API calls
            </p>
          </div>
        ) : (
          context.apis.map((category) => (
            <CategorySection
              key={category.name}
              category={category}
              expanded={expandedCategories.has(category.name)}
              onToggle={() => toggleCategory(category.name)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface CategorySectionProps {
  category: APICategory;
  expanded: boolean;
  onToggle: () => void;
}

function CategorySection({ category, expanded, onToggle }: CategorySectionProps) {
  return (
    <div className="card">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown size={16} className="text-[var(--text-muted)]" />
          ) : (
            <ChevronRight size={16} className="text-[var(--text-muted)]" />
          )}
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {category.name}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            category.type === 'graphql' 
              ? 'bg-pink-500/20 text-pink-400' 
              : 'bg-blue-500/20 text-blue-400'
          }`}>
            {category.type.toUpperCase()}
          </span>
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          {category.endpoints.length} endpoints
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {category.endpoints.map((endpoint, idx) => (
            <EndpointRow key={idx} endpoint={endpoint} />
          ))}
        </div>
      )}
    </div>
  );
}

function EndpointRow({ endpoint }: { endpoint: APIEndpoint }) {
  const [expanded, setExpanded] = useState(false);
  
  const methodColors: Record<string, string> = {
    GET: 'text-green-400',
    POST: 'text-blue-400',
    PUT: 'text-yellow-400',
    PATCH: 'text-orange-400',
    DELETE: 'text-red-400',
  };

  const AuthIcon = {
    bearer: Lock,
    'api-key': Key,
    cookie: Cookie,
    none: Globe,
  }[endpoint.authType ?? 'none'];

  return (
    <div className="bg-[var(--bg-primary)] rounded-lg p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-semibold ${methodColors[endpoint.method] ?? 'text-gray-400'}`}>
            {endpoint.method}
          </span>
          <span className="text-xs font-mono text-[var(--text-primary)] truncate flex-1">
            {endpoint.path}
          </span>
          <AuthIcon size={12} className="text-[var(--text-muted)]" />
        </div>
        
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-xs text-[var(--text-muted)]">
            {endpoint.callCount} calls
          </span>
          {Object.keys(endpoint.queryParams).length > 0 && (
            <span className="text-xs text-[var(--text-muted)]">
              {Object.keys(endpoint.queryParams).length} params
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--border-color)] space-y-2">
          <div>
            <span className="text-xs text-[var(--text-muted)]">Full URL:</span>
            <p className="text-xs font-mono text-[var(--text-secondary)] break-all mt-1">
              {endpoint.url}
            </p>
          </div>
          
          {Object.keys(endpoint.queryParams).length > 0 && (
            <div>
              <span className="text-xs text-[var(--text-muted)]">Query Params:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(endpoint.queryParams).map(([key, value]) => (
                  <span key={key} className="text-xs bg-[var(--bg-tertiary)] px-2 py-0.5 rounded">
                    {key}={value.substring(0, 20)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {endpoint.requestSchema && (
            <div>
              <span className="text-xs text-[var(--text-muted)]">Request Schema:</span>
              <pre className="text-xs font-mono text-[var(--text-secondary)] mt-1 overflow-x-auto">
                {JSON.stringify(endpoint.requestSchema, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

