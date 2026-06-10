---
"@peace/web": minor
"@peace/ui": patch
---

Rebuild the meeting workspace on the design system (themed, live data)

Replace the Tailwind `@peace/ui` `WorkspaceShell` at `/meeting/[id]` with a new intent-canvas workspace built on `@peace/design` tokens + the kit. Three themed panels over live meeting data: the transcript as kit `ChatBubble`s, the artifacts as decision/action/question/key-point cards (with evidence chips + uncertainty), and the Mermaid diagram re-rendered in mermaid's light/dark theme to match the active peace theme. Evidence cross-linking lights source segments on hover and drills into a themed modal (kit `ZoomStack`) showing the transcript turns that justify each item; tap a panel surface to expand. The fetch + live-subscribe + delta logic is extracted into a reusable `useWorkspace` hook (`applyWorkspaceDelta` is now exported from `@peace/ui`). The whole surface — including the diagram — re-skins with the theme switcher.
