import { useEffect, useState } from 'react';
import { getRecommendedOnly, setRecommendedOnly } from '../lib/recommendedFunds';

const EVT = 'recommendedonlychange';

export function useRecommendedOnly(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => getRecommendedOnly());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === 'boolean') setValue(detail);
    };
    window.addEventListener(EVT, handler);
    return () => window.removeEventListener(EVT, handler);
  }, []);

  const update = (v: boolean) => {
    setRecommendedOnly(v);
    setValue(v);
  };
  return [value, update];
}
