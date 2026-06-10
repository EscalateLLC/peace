---
'@peace/design': minor
---

Add the `interactive()` authoring mixin and a `@peace/design/mixins` package export.

`interactive()` composes the resting `surface()` with the hover / focus / selected
recipe — driven entirely by the per-theme `--peace-*` interaction tokens — so a single
include yields the full rest → hover → focus → selected language and re-skins with the
active theme. Exposed via the new `./mixins` subpath for SCSS consumers; the kit and
playground continue to consume the tokens directly.
