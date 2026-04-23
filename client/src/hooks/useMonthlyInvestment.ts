import { useEffect, useState } from 'react';

const KEY = 'monthlyInvestment';
const DEFAULT = 30000;
const EVT = 'monthlyinvestmentchange';

export function getMonthlyInvestment(): number {
  if (typeof window === 'undefined') return DEFAULT;
  const v = localStorage.getItem(KEY);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT;
}

export function setMonthlyInvestment(n: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEY, String(n));
    window.dispatchEvent(new CustomEvent(EVT, { detail: n }));
  }
}

export function useMonthlyInvestment(): [number, (n: number) => void] {
  const [value, setValue] = useState<number>(() => getMonthlyInvestment());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === 'number') setValue(detail);
    };
    window.addEventListener(EVT, handler);
    return () => window.removeEventListener(EVT, handler);
  }, []);

  const update = (n: number) => {
    setMonthlyInvestment(n);
    setValue(n);
  };
  return [value, update];
}

export function formatYen(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(2)}億円`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万円`;
  return `${Math.round(n).toLocaleString()}円`;
}
