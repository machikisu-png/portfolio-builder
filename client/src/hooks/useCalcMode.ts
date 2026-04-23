import { useEffect, useState } from 'react';
import { getCalcMode, setCalcMode, type CalcMode } from '../lib/optimizer';

export function useCalcMode(): [CalcMode, (m: CalcMode) => void] {
  const [mode, setMode] = useState<CalcMode>(() => getCalcMode());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CalcMode>).detail;
      if (detail) setMode(detail);
    };
    window.addEventListener('calcmodechange', handler);
    return () => window.removeEventListener('calcmodechange', handler);
  }, []);

  const update = (m: CalcMode) => {
    setCalcMode(m);
    setMode(m);
  };
  return [mode, update];
}
