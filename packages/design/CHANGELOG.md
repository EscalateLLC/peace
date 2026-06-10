# @peace/design

## 0.2.0

### Minor Changes

- 4dfcaa1: Add @peace/design — the runtime theming system

  A new `@peace/design` package: the `--peace-*` design-token contract (SCSS theme maps → CSS custom properties), seven runtime-swappable themes (tron, cloud, confluence, dreadnought, platinum, royalty, bubble), each with a distinct **interaction language** — hover glow + border, hard focus border, themed move/lift — plus the `corner()` keystone (runtime bevel↔radius↔square) and an SSR-safe no-flash `ThemeProvider` / `useTheme` / `ThemeToggle`. The kit controls consume the token contract (via a `--pk-*` → `--peace-*` alias), so they re-skin with the active theme. `/mockups/kit` becomes a design-system playground (theme · typeface · density · motion + a full control/state gallery).

- e6dd144: Theme the product: design-system root + themed home

  Wire `@peace/design` into the product root (`app/layout.tsx`): load `@peace/design/styles` + the core fonts (Hanken / JetBrains Mono / Fraunces) + the kit `--pk-*` alias, wrap the tree in `ThemeProvider`, and apply the themed `.peace-root` to `<body>`. Add a `color-scheme` token (dark/light per theme) so native scrollbars + form controls match. Rebuild the home / meeting list on `--peace-*` tokens with a theme `<select>` switcher — readable across light and dark themes, with the per-theme interaction recipe on the meeting cards. Mockups stay on Tailwind.
