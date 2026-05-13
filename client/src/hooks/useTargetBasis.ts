import { useEffect, useState } from 'react';

/**
 * 目標値の前提:
 *   'classic' = エクセル計算表由来の古典的目標値（教科書ベース）
 *   'modern'  = 20年実データから推定した最新値（ヒストリカル共分散）
 */
export type TargetBasis = 'classic' | 'modern';

const KEY = 'targetBasis';
const EVT = 'targetbasischange';

export function getTargetBasis(): TargetBasis {
  if (typeof window === 'undefined') return 'classic';
  return localStorage.getItem(KEY) === 'modern' ? 'modern' : 'classic';
}

export function setTargetBasis(value: TargetBasis): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, value);
  window.dispatchEvent(new CustomEvent(EVT, { detail: value }));
}

export function useTargetBasis(): [TargetBasis, (v: TargetBasis) => void] {
  const [value, setValue] = useState<TargetBasis>(() => getTargetBasis());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TargetBasis>).detail;
      if (detail === 'classic' || detail === 'modern') setValue(detail);
    };
    window.addEventListener(EVT, handler);
    return () => window.removeEventListener(EVT, handler);
  }, []);

  const update = (v: TargetBasis) => {
    setTargetBasis(v);
    setValue(v);
  };
  return [value, update];
}
