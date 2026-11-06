// How far along the page's load looks: it creeps on while it loads (pages
// don't say how far they are), fills when it's done, then goes.

import { useEffect, useState } from 'react';

export function useProgress(loading: boolean): number | null {
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    if (!loading) {
      setValue((v) => (v === null ? null : 1));
      const done = setTimeout(() => setValue((v) => (v === 1 ? null : v)), 250);
      return () => clearTimeout(done);
    }
    setValue(0.08);
    const timer = setInterval(() => setValue((v) => (v === null ? null : v + (0.9 - v) * 0.06)), 120);
    return () => clearInterval(timer);
  }, [loading]);
  return value;
}
