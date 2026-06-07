'use client';

export interface EvidenceChipProps {
  sourceSegmentIds: string[];
  onHighlight: (segmentIds: string[]) => void;
}

/**
 * The click-through from an artifact item to the transcript segments backing
 * it. Clicking highlights + scrolls the transcript panel.
 */
export function EvidenceChip ({ sourceSegmentIds, onHighlight }: EvidenceChipProps) {
  return (
    <button
      type="button"
      onClick={() => onHighlight(sourceSegmentIds)}
      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-emerald-700/50 bg-emerald-950/40 px-2 py-0.5 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-900/60"
      title="Show supporting transcript segments"
    >
      <span aria-hidden>◈</span>
      {sourceSegmentIds.length === 1 ? 'evidence' : `evidence ×${sourceSegmentIds.length}`}
    </button>
  );
}

export function UncertainBadge () {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border border-amber-700/50 bg-amber-950/40 px-2 py-0.5 text-[11px] font-medium text-amber-300"
      title="The transcript only weakly supports this item"
    >
      uncertain
    </span>
  );
}
