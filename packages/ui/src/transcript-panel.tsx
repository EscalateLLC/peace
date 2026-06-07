'use client';

import { useEffect, useRef } from 'react';
import type { ConversationEvent } from '@peace/core';
import { formatOffset, speakerHue } from './format';

export interface TranscriptPanelProps {
  segments: ConversationEvent[];

  /** Segment ids to highlight (from an evidence chip click). */
  highlightedIds: ReadonlySet<string>;

  /** While the meeting is live, keep the view pinned to the newest segment. */
  live: boolean;
}

/**
 * The transcript pane: time-ordered utterances with speaker coloring,
 * evidence highlighting (scrolls the first highlighted segment into view),
 * and live tail-follow while the bot is in a call.
 */
export function TranscriptPanel ({ segments, highlightedIds, live }: TranscriptPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstHighlighted = segments.find(segment => highlightedIds.has(segment.id))?.id;

  useEffect(() => {
    if (firstHighlighted) {
      containerRef.current
        ?.querySelector(`[data-segment-id="${firstHighlighted}"]`)
        ?.scrollIntoView({
          behavior: 'smooth',
          block   : 'center'
        });
    }
  }, [firstHighlighted, highlightedIds]);

  const lastId = segments.at(-1)?.id;

  useEffect(() => {
    if (live && highlightedIds.size === 0 && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [live, lastId, highlightedIds]);

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-2"
    >
      {segments.length === 0 && (
        <p className="mt-8 text-center text-sm text-zinc-500">
          {live ? 'Listening… transcript will appear here.' : 'No transcript segments.'}
        </p>
      )}
      {segments.map(segment => {
        const highlighted = highlightedIds.has(segment.id);
        const hue = speakerHue(segment.speakerId);

        return (
          <div
            key={segment.id}
            data-segment-id={segment.id}
            data-highlighted={highlighted || undefined}
            className={`rounded-md px-2 py-1.5 transition-colors ${highlighted ? 'bg-emerald-900/40 ring-1 ring-emerald-600/60' : 'hover:bg-zinc-900'}`}
          >
            <div className="flex items-baseline gap-2">
              <span
                className="text-xs font-semibold"
                style={{ color: `hsl(${hue} 70% 65%)` }}
              >
                {segment.speakerLabel}
              </span>
              <span className="font-mono text-[10px] text-zinc-500">{formatOffset(segment.tStart)}</span>
              {segment.confidence < 0.7 && (
                <span
                  className="text-[10px] text-zinc-500"
                  title={`transcription confidence ${Math.round(segment.confidence * 100)}%`}
                >
                  ~
                </span>
              )}
            </div>
            <p className={`text-sm leading-snug ${segment.confidence < 0.7 ? 'text-zinc-400' : 'text-zinc-200'}`}>
              {segment.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
