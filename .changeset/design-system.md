---
"@peace/design": minor
"@peace/web": minor
---

Add @peace/design — the runtime theming system

A new `@peace/design` package: the `--peace-*` design-token contract (SCSS theme maps → CSS custom properties), seven runtime-swappable themes (tron, cloud, confluence, dreadnought, platinum, royalty, bubble), each with a distinct **interaction language** — hover glow + border, hard focus border, themed move/lift — plus the `corner()` keystone (runtime bevel↔radius↔square) and an SSR-safe no-flash `ThemeProvider` / `useTheme` / `ThemeToggle`. The kit controls consume the token contract (via a `--pk-*` → `--peace-*` alias), so they re-skin with the active theme. `/mockups/kit` becomes a design-system playground (theme · typeface · density · motion + a full control/state gallery).
