---
'@peace/web': minor
---

Add a stacking, dismissable workspace banner system and a panel error boundary.

New kit `feedback` primitive — `useBanners()` / `<BannerStack>` (mirrors
`useZoomStack` / `<ZoomStack>`: dedup by `code`, `ttl` auto-dismiss, sticky errors)
plus an `<ErrorBoundary>`. The workspace now routes load errors and delta notices
into one stack (replacing the single bespoke notice), and wraps each panel body so
a panel's render error shows a per-panel fallback + an error banner instead of
blanking the whole deck.
