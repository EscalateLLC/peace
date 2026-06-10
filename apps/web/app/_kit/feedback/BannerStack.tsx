import { useCallback, useEffect, useRef, useState } from 'react';
import './banner-stack.css';

/**
 * Dismissable workspace banners that stack. Mirrors `useZoomStack` / `<ZoomStack>`:
 * a hook owns the list, a component renders it. Pushing a banner with a `code`
 * that's already showing refreshes it in place (no duplicate pile-up); a `ttl`
 * auto-dismisses after that many ms (omit for a sticky banner — e.g. errors).
 */

export type BannerSeverity = 'info' | 'warning' | 'error';

export interface Banner {
  id: string;
  severity: BannerSeverity;
  message: string;
  ttl?: number;
}

export interface BannerInput {
  severity: BannerSeverity;
  message: string;

  /** Dedup key — pushing the same code refreshes that banner instead of stacking a copy. */
  code?: string;

  /** Auto-dismiss after this many ms; omit for a sticky banner. */
  ttl?: number;
}

export interface BannerController {
  banners: Banner[];
  push: (input: BannerInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export function useBanners (): BannerController {
  const [banners, setBanners] = useState<Banner[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: string) => {
    setBanners(list => list.filter(banner => banner.id !== id));
  }, []);

  const clear = useCallback(() => setBanners([]), []);

  const push = useCallback((input: BannerInput): string => {
    const id = input.code ? `code:${input.code}` : `b:${seq.current++}`;

    setBanners(list => [
      ...list.filter(banner => banner.id !== id),
      {
        id,
        severity: input.severity,
        message : input.message,
        ttl     : input.ttl
      }
    ]);

    return id;
  }, []);

  // Auto-dismiss the banners that carry a ttl.
  useEffect(() => {
    const timers = banners
      .filter(banner => banner.ttl)
      .map(banner => setTimeout(() => dismiss(banner.id), banner.ttl));

    return () => timers.forEach(clearTimeout);
  }, [banners, dismiss]);

  return {
    banners,
    push,
    dismiss,
    clear
  };
}

/** Renders the stack. Mount once near the top of the host; feed it `useBanners()`. */
export function BannerStack ({ banners, onDismiss }: { banners: Banner[]; onDismiss: (id: string) => void }) {
  if (banners.length === 0) {
    return null;
  }

  return (
    <div
      className="pk-banners"
      data-part="banner-stack"
      role="status"
      aria-live="polite">
      {banners.map(banner => (
        <div
          key={banner.id}
          className="pk-banner"
          data-part="banner"
          data-sev={banner.severity}>
          <span className="pk-banner-msg">{banner.message}</span>
          <button
            type="button"
            className="pk-banner-x"
            aria-label="Dismiss"
            onClick={() => onDismiss(banner.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
