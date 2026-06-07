'use client';

import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { parseArtifactContent, type Artifact, type ArtifactType } from '@peace/core';
import { EvidenceChip, UncertainBadge } from './evidence-chip';

const TABS: { type: ArtifactType; label: string }[] = [
  {
    type : 'summary',
    label: 'Summary'
  },
  {
    type : 'action-items',
    label: 'Actions'
  },
  {
    type : 'decisions',
    label: 'Decisions'
  },
  {
    type : 'open-questions',
    label: 'Questions'
  },
  {
    type : 'key-points',
    label: 'Key points'
  }
];

export interface ArtifactsPanelProps {
  artifacts: Artifact[];
  onHighlight: (segmentIds: string[]) => void;
  onRegenerate: () => void;
  regenerating: boolean;
  loadVersions: (type: ArtifactType) => Promise<Artifact[]>;
}

/**
 * The artifacts pane: tabbed Summary / Actions / Decisions / Questions /
 * Key points, every item carrying its evidence chip and uncertainty badge,
 * with an immutable version history selector per tab.
 */
export function ArtifactsPanel ({ artifacts, onHighlight, onRegenerate, regenerating, loadVersions }: ArtifactsPanelProps) {
  const [tab, setTab] = useState<ArtifactType>('summary');
  const [versions, setVersions] = useState<Artifact[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const latest = artifacts.find(artifact => artifact.type === tab) ?? null;

  useEffect(() => {
    setSelectedVersion(null);
    setVersions([]);

    if (latest && latest.version > 1) {
      loadVersions(tab).then(setVersions)
        .catch(() => setVersions([]));
    }
  }, [tab, latest, loadVersions]);

  const shown = selectedVersion === null ? latest : versions.find(artifact => artifact.version === selectedVersion) ?? latest;
  let versionOptions = versions;

  if (versionOptions.length === 0 && latest) {
    versionOptions = [latest];
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-zinc-800 px-2 pt-2">
        {TABS.map(item => (
          <button
            key={item.type}
            type="button"
            onClick={() => setTab(item.type)}
            className={`rounded-t-md px-2.5 py-1.5 text-xs font-medium transition-colors ${tab === item.type ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {item.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-1">
          {(versions.length > 1 || (latest?.version ?? 1) > 1) && (
            <select
              value={selectedVersion ?? latest?.version ?? 1}
              onChange={event => setSelectedVersion(Number(event.target.value))}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-300"
              title="Version history (versions are immutable)"
            >
              {versionOptions.map(artifact => (
                <option
                  key={artifact.id}
                  value={artifact.version}
                >
                  v{artifact.version}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {shown ? <ArtifactBody
          artifact={shown}
          onHighlight={onHighlight}
        /> : <p className="mt-8 text-center text-sm text-zinc-500">
          No {TABS.find(item => item.type === tab)?.label.toLowerCase()} yet.
        </p>}
      </div>
    </div>
  );
}

function ArtifactBody ({ artifact, onHighlight }: { artifact: Artifact; onHighlight: (ids: string[]) => void }) {
  const parsed = parseArtifactContent(artifact.type, artifact.content);

  switch (parsed.type) {
    case 'summary':
      return (
        <div className="prose prose-sm prose-invert max-w-none prose-p:leading-snug prose-li:leading-snug">
          <Markdown>{parsed.content.markdown}</Markdown>
        </div>
      );

    case 'action-items':
      return (
        <ul className="flex flex-col gap-2">
          {parsed.content.items.map((item, index) => (
            <li
              key={index}
              className="rounded-md border border-zinc-800 bg-zinc-900/60 p-2.5"
            >
              <p className="text-sm text-zinc-200">{item.description}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                {item.assignee && <span className="rounded bg-zinc-800 px-1.5 py-0.5">@{item.assignee}</span>}
                {item.dueDate && <span className="rounded bg-zinc-800 px-1.5 py-0.5">due {item.dueDate}</span>}
                {item.uncertain && <UncertainBadge />}
                <EvidenceChip
                  sourceSegmentIds={item.sourceSegmentIds}
                  onHighlight={onHighlight}
                />
              </div>
            </li>
          ))}
        </ul>
      );

    case 'decisions':
      return (
        <ul className="flex flex-col gap-2">
          {parsed.content.items.map((item, index) => (
            <li
              key={index}
              className="rounded-md border border-zinc-800 bg-zinc-900/60 p-2.5"
            >
              <p className="text-sm font-medium text-zinc-200">{item.description}</p>
              {item.rationale && <p className="mt-1 text-xs leading-snug text-zinc-400">{item.rationale}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {item.uncertain && <UncertainBadge />}
                <EvidenceChip
                  sourceSegmentIds={item.sourceSegmentIds}
                  onHighlight={onHighlight}
                />
              </div>
            </li>
          ))}
        </ul>
      );

    case 'open-questions':
      return (
        <SimpleItems
          items={parsed.content.items.map(item => ({
            text     : item.question,
            ids      : item.sourceSegmentIds,
            uncertain: item.uncertain
          }))}
          onHighlight={onHighlight}
        />
      );

    case 'key-points':
      return (
        <SimpleItems
          items={parsed.content.items.map(item => ({
            text     : item.point,
            ids      : item.sourceSegmentIds,
            uncertain: item.uncertain
          }))}
          onHighlight={onHighlight}
        />
      );

    default:
      return null;
  }
}

interface SimpleItem {
  text: string;
  ids: string[];
  uncertain: boolean;
}

function SimpleItems ({ items, onHighlight }: { items: SimpleItem[]; onHighlight: (ids: string[]) => void }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li
          key={index}
          className="flex items-start justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 p-2.5"
        >
          <p className="text-sm text-zinc-200">{item.text}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {item.uncertain && <UncertainBadge />}
            <EvidenceChip
              sourceSegmentIds={item.ids}
              onHighlight={onHighlight}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
