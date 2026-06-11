import { useEffect, useState } from 'react';

/**
 * The 2-D canvas is opt-in: the `NEXT_PUBLIC_CANVAS_2D` config flag, or a per-browser
 * `peace:canvas2d` toggle. Resolved after mount so the flag can't split SSR vs client.
 */
export function useCanvas2D (): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(process.env.NEXT_PUBLIC_CANVAS_2D === '1' || localStorage.getItem('peace:canvas2d') === '1');
  }, []);

  return on;
}
