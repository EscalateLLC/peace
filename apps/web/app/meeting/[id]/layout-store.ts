'use client';

import type { PanelId } from './panels';

/** A panel's placement on the canvas grid (cell coords) + stacking order. */
export interface CellRect {
  cx: number;
  cy: number;
  cw: number;
  ch: number;
  z: number;
}

export type CanvasLayout = Record<PanelId, CellRect>;

const key = (meetingId: string) => `peace:layout:${meetingId}`;

/**
 * Temporary, per-browser canvas-layout store (localStorage). This is the seam the
 * settings system later swaps for a per-user, DB-backed store with no canvas rework —
 * see `internal/phase-2-follow-up/settings-persistence.md`. Both reads and writes
 * fail soft (private mode / quota / SSR) so layout never breaks the workspace.
 */
export const layoutStore = {
  load (meetingId: string): CanvasLayout | null {
    try {
      const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key(meetingId));

      return raw ? (JSON.parse(raw) as CanvasLayout) : null;
    } catch {
      return null;
    }
  },

  save (meetingId: string, layout: CanvasLayout): void {
    try {
      localStorage.setItem(key(meetingId), JSON.stringify(layout));
    } catch {
      // ignore — private mode, quota, or no localStorage
    }
  }
};
