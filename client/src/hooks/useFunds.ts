import { useState, useEffect, useCallback } from 'react';
import type { Fund, SearchFilters } from '../lib/types';
import { scoreFund } from '../lib/fundScorer';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

export function useFunds(filters: SearchFilters) {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFunds = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.nisaOnly) params.set('nisaOnly', 'true');
      if (filters.source !== 'all') params.set('source', filters.source);
      if (filters.minReturn !== null) params.set('minReturn', String(filters.minReturn));
      if (filters.maxExpenseRatio !== null) params.set('maxExpenseRatio', String(filters.maxExpenseRatio));

      // スコアソートはクライアント側で行うので、サーバーにはデフォルトソートを送る
      if (filters.sortBy !== 'score') {
        params.set('sortBy', filters.sortBy);
        params.set('sortOrder', filters.sortOrder);
      }

      const res = await fetch(`${API_BASE}/funds?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      let sorted: Fund[] = data.funds;

      // スコアソート（クライアント側）
      if (filters.sortBy === 'score') {
        sorted = [...sorted].sort((a, b) => {
          const sa = scoreFund(a).total;
          const sb = scoreFund(b).total;
          return filters.sortOrder === 'desc' ? sb - sa : sa - sb;
        });
      }

      setFunds(sorted);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  return { funds, loading, error, refetch: fetchFunds };
}
