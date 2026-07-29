import { useState, useEffect } from 'react';

export function useCountUp(target: number, duration: number = 1500, decimals: number = 0) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(parseFloat((target * eased).toFixed(decimals)));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, decimals]);

  return value;
}
