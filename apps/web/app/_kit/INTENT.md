# Intent Surface — interaction model (canonical reference)

The intent surface is the canvas substrate: a set of panels you can **drag**, **zoom**,
and **act on**. This document is the single source of truth for the nuanced interactions.
The kit (`IntentSurface` / `useIntentGesture` + the controls) must implement exactly this.

> Status: **spec under confirmation.** Sections marked **⚠ confirm** are proposed defaults
> awaiting sign-off before implementation. Everything else is the agreed model.

---

## 1. The core idea — a fractal zoom

Every interaction is one of three verbs: **drag**, **zoom**, or **act**. Which one fires is
decided by **where the pointer is** and **whether you tap or hold-and-drag**. The cursor and a
highlight always **preview the outcome before you commit**.

The zoom is **fractal**: the *same* "resize into a focused modal" gesture applies to a whole
**panel** and to a single **element** inside it. You zoom a panel to fill the canvas; you zoom a
chat bubble to focus just that bubble — same feel, one level down.

## 2. The two gestures

| Gesture | What it is | What it does |
|---|---|---|
| **Tap** | press + release, < ~8px movement | **zoom** or **act**, by target (below) |
| **Press-hold + drag** | press, then move past ~8px | **reorder the panel** — works from **ANY part of the panel**, not just a handle |

Holding the mouse down lets you **drag from anywhere**. A clean tap zooms/acts. While you hold
(before/while dragging) the cursor is the **grabbing hand**.

## 3. Targets — what's under the pointer

A panel has these target zones:

1. **Frame** — a thin inset band around the panel's inner content (a padding ring, **default ~15%
   inset**, configurable). This is the **primary drag handle**: at rest the cursor **defaults to
   grab** here, telling you "hold to drag." Tap → zooms the panel; drag → reorder.
2. **Surface** — the panel's empty inner space. Hover → **the panel is highlighted** + zoom cursor.
   **Tap → zoom the panel** (resize up into a focused full modal). Drag → reorder.
3. **Element** — a *zoomable content control* (chat bubble, summary card, diagram node …). Hover →
   **that element is highlighted** (not the panel) + zoom cursor. **Tap → zoom the element** into a
   focused modal (the panel modal, one level down). Drag → reorder the panel.
4. **Action** — a *genuine action control* (DOCK, send, the command input, a resize gutter). Hover →
   pointer + the control highlighted. **Tap → its own action.** Not a drag handle.

**Drag** works on Frame + Surface + Element (anywhere you can hold). Only **Action** controls are
exempt — pressing them is their own click.

## 4. How you KNOW what will happen (highlight + cursor preview)

The highlight target **is** the action target — this is the whole point of "granular intent":

| Pointer is over… | Highlight | Cursor (at rest) | A tap will… |
|---|---|---|---|
| **Frame** (edge band) | panel frame | **grab** | (zoom the panel) |
| **Surface** (empty inner) | **the panel** | zoom-in (zoom-out if already zoomed) | **zoom the panel** |
| **Element** (chat bubble…) | **the element** | zoom-in | **zoom that element** |
| **Action** (button) | the control | pointer | do its action |
| *…while holding to drag* | the dragged panel | **grabbing** | (you're dragging) |

So: **element highlighted → you'll zoom the element; panel highlighted → you'll zoom the panel.**

## 5. The zoom = a focused modal, at two scales (and they stack)

- **Panel zoom** — the panel resizes up into a focused, full-canvas modal (today's "maximize").
  Trigger: tap Surface / Frame / grip. Return: Esc, tap the dim backdrop, or DOCK.
- **Element zoom (drill-down)** — the element lifts + enlarges into a focused modal over a **dimmed
  panel** (same interaction, element scale). The modal **is the interface for that element**: it
  shows the content enlarged plus the ways to act on it. Trigger: tap the Element. Return: Esc or
  tap-out.
- **Modals stack.** Zooming an element *while a panel is already zoomed* opens a **second, stacked
  modal** on top of the first (e.g. panel zoomed → tap a diagram node → the node's drill-down modal
  stacks over it). Esc / tap-out pops the top modal; the stack unwinds one level at a time.

Both are the same primitive at different scopes; the kit exposes **one zoom mechanism** that any
`content` control (or the panel) drives, with a small modal stack.

### 5.1 The drill-down modal content (per control)

The element-zoom modal is where rich interaction lives — it replaces docked side-panels. For a
**diagram node**, the modal shows (retiring the old docked inspector — its content moves here):

- the node, focused/enlarged (kind, label, status);
- **its cross-linked evidence**, displayed and highlighted (the segments/items it cites);
- **its actions** — the same "actions for this item" surface the ACTIONS panel already provides,
  shown explicitly here;
- affordances to **edit the node**, **leave replies / comments**, link, make a ticket, ask peace.

A `ChatBubble`'s modal is simpler (the message enlarged for reading + its own actions/links). Each
`content` control defines what its drill-down modal contains; the kit provides the zoom/stack/dismiss
shell, the control provides the body.

## 6. Cursor reference (target × phase)

```
phase = idle (hover) | press-hold | drag

idle  + frame    → grab
idle  + surface  → zoom-in   (zoom-out when the panel is already zoomed)
idle  + element  → zoom-in   (zoom-out when the element is already zoomed)
idle  + action   → pointer
press-hold (frame/surface/element) → grabbing
drag  (frame/surface/element)      → grabbing
```

## 7. Kit mapping — `data-intent` + API

- `data-intent="surface"` (default) — the panel body + its frame band. Tap zooms the panel; drag
  reorders. The frame is the inset sub-zone where the cursor defaults to grab (inset configurable).
- `data-intent="content"` — a **zoomable element** (e.g. `ChatBubble`). Tap zooms the element; drag
  reorders the panel; hover highlights the element.
- `data-intent="control"` — a **genuine action control**. Tap = own action; never zooms/drags.

`useIntentGesture` responsibilities (what changed vs the regressed version):
- **Arm the drag on `surface` AND `content`** (not just surface) → drag-from-anywhere. Only
  `control` is exempt.
- **Capture only after the drag threshold**, so a clean tap on an element passes through to the
  element's own click (its zoom); a drag suppresses that click and reorders instead.
- **Tap routing:** `surface` → zoom panel; `content` → the element's `onActivate` (zoom element);
  `control` → native click.
- **Frame zone:** expose an inset band (default ~15%) of a `surface` whose **rest cursor is grab**;
  everywhere else on a surface/element the rest cursor is the zoom cursor.
- **Highlight:** emit which target is hot (`panel` vs the specific `element`) so the host/CSS
  highlights exactly that — `data-hover-intent` on the panel + the element's own `:hover`/data-attr.
- **Element zoom:** a kit primitive (e.g. `useZoom` / a `ZoomLayer`) that any `content` control uses
  to lift into the focused modal; mirrors the panel maximize.

## 8. Decisions — CONFIRMED

1. **Diagram nodes are `content`.** Tap zooms the node into a **drill-down modal** (§5.1) that holds
   its actions + cross-linked evidence + edit/reply. **The docked side-inspector is removed** — its
   content moves into the modal.
2. **Evidence cross-link stays.** On **hover**, an element lights itself **and** its cross-linked
   evidence. On **tap**, the element zooms; the **drill-down modal displays the cross-linked
   evidence** inside it.
3. **Tapping the Frame** zooms the panel (frame = surface for taps).
4. **Action controls** keep their own click and aren't drag handles; drag the panel from non-action
   areas (or by holding anywhere else).
5. **Frame inset** defaults to ~15% (clamped to a sensible px range), configurable per surface.
6. **Modals stack** (§5): an element drill-down opens over an already-zoomed panel; Esc/tap-out pops
   one level.

---

## Implementation note (current state vs this spec)

The deck currently regresses this model: the whole panel body is marked `content`, so **drag only
works on the grip**, and a chat-bubble tap does a cross-link instead of an **element zoom**. Bringing
the kit + deck in line with this spec is the work to do once §8 is confirmed.
