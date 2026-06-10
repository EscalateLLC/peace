---
"@peace/design": minor
"@peace/web": minor
---

Theme the product: design-system root + themed home

Wire `@peace/design` into the product root (`app/layout.tsx`): load `@peace/design/styles` + the core fonts (Hanken / JetBrains Mono / Fraunces) + the kit `--pk-*` alias, wrap the tree in `ThemeProvider`, and apply the themed `.peace-root` to `<body>`. Add a `color-scheme` token (dark/light per theme) so native scrollbars + form controls match. Rebuild the home / meeting list on `--peace-*` tokens with a theme `<select>` switcher — readable across light and dark themes, with the per-theme interaction recipe on the meeting cards. Mockups stay on Tailwind.
