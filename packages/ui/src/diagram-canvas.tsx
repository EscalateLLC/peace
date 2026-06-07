'use client';

import { useState } from 'react';
import { parseArtifactContent, type Artifact } from '@peace/core';
import { MermaidView } from './mermaid-view';

export interface DiagramCanvasProps {
  artifact: Artifact | null;
  onHighlight: (segmentIds: string[]) => void;
  onSaveSource: (mermaid: string) => Promise<void>;
  onRegenerate: () => void;
  regenerating: boolean;
}

/**
 * The diagram pane: Mermaid render + collapsible source editor (edit →
 * live re-render → save as a new immutable version) + per-node evidence.
 */
export function DiagramCanvas ({ artifact, onHighlight, onSaveSource, onRegenerate, regenerating }: DiagramCanvasProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!artifact) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-zinc-500">
        No diagram yet — it is generated with the other artifacts.
      </div>
    );
  }

  const content = parseArtifactContent('diagram', artifact.content);

  if (content.type !== 'diagram') {
    return null;
  }

  const source = draft ?? content.content.mermaid;
  const dirty = draft !== null && draft !== content.content.mermaid;
  const nodeEvidence = Object.entries(content.content.nodeEvidence);

  const save = async () => {
    if (!dirty) {
      return;
    }

    setSaving(true);

    try {
      await onSaveSource(source);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-zinc-200">
          {artifact.title}
          <span className="ml-2 font-normal text-zinc-500">v{artifact.version}</span>
        </h3>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
        >
          {regenerating ? 'Regenerating…' : 'Regenerate'}
        </button>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
        <MermaidView source={source} />
      </div>

      <details className="group rounded-lg border border-zinc-800">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200">
          Edit Mermaid source
        </summary>
        <div className="flex flex-col gap-2 p-3 pt-0">
          <textarea
            value={source}
            onChange={event => setDraft(event.target.value)}
            spellCheck={false}
            rows={Math.min(18, source.split('\n').length + 2)}
            className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 p-2 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                save().catch(() => undefined);
              }}
              disabled={!dirty || saving}
              className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save as new version'}
            </button>
            {dirty && (
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Discard
              </button>
            )}
          </div>
        </div>
      </details>

      {nodeEvidence.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-zinc-500">Node evidence:</span>
          {nodeEvidence.map(([nodeId, segmentIds]) => (
            <button
              key={nodeId}
              type="button"
              onClick={() => onHighlight(segmentIds)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300 hover:bg-zinc-800"
              title="Show transcript segments backing this node"
            >
              {nodeId}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
