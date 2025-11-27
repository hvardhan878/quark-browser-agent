import { useState, useEffect, useCallback } from 'react';
import type { SiteContext } from '../../shared/types';

interface UseSiteContextReturn {
  context: SiteContext | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSiteContext(): UseSiteContextReturn {
  const [context, setContext] = useState<SiteContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await chrome.runtime.sendMessage({
        type: 'GET_SITE_CONTEXT',
        payload: {},
      });

      if (response?.error) {
        setError(response.error);
      } else if (response) {
        setContext(response as SiteContext);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get site context');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContext();

    // Listen for context updates
    const handleMessage = (message: { type: string; payload?: unknown }) => {
      if (message.type === 'SITE_CONTEXT_UPDATED' && message.payload) {
        setContext(message.payload as SiteContext);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Refresh when tab changes
    const handleTabChange = () => {
      fetchContext();
    };

    chrome.tabs.onActivated?.addListener(handleTabChange);
    chrome.tabs.onUpdated?.addListener((_tabId, changeInfo) => {
      if (changeInfo.status === 'complete') {
        fetchContext();
      }
    });

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      chrome.tabs.onActivated?.removeListener(handleTabChange);
    };
  }, [fetchContext]);

  return {
    context,
    loading,
    error,
    refresh: fetchContext,
  };
}

