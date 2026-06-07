import { parseArtifactContent, type Artifact, type ArtifactType } from '@peace/core';
import { getSegments, type PeaceDb } from '@peace/db';
import { createAiGenerator, runPipeline, type StructuredGenerator } from '@peace/pipeline';
import { getDefaultModel } from '@peace/ai';

export type CommandIntent = 'start' | 'join' | 'stop' | 'summarize' | 'decisions' | 'actions' | 'questions' | 'diagram' | 'help';

const INTENT_PATTERNS: [RegExp, CommandIntent][] = [
  [/\b(?:start|begin)\b/iu, 'start'],
  [/\bjoin\b/iu, 'join'],
  [/\b(?:stop|leave|end)\b/iu, 'stop'],
  [/\bsummar/iu, 'summarize'],
  [/\bdecision/iu, 'decisions'],
  [/\b(?:action|task|todo)/iu, 'actions'],
  [/\b(?:question|unresolved|open)\b/iu, 'questions'],
  [/\b(?:diagram|flow|chart|map)\b/iu, 'diagram'],
  [/\bhelp\b/iu, 'help']
];

/** Parse what the user wants from the text after the bot mention. */
export function parseIntent (text: string): CommandIntent | null {
  for (const [pattern, intent] of INTENT_PATTERNS) {
    if (pattern.test(text)) {
      return intent;
    }
  }

  return null;
}

export const HELP_TEXT = [
  'I am **peace** — I listen, take notes, and turn this conversation into evidence-linked artifacts.',
  '',
  '`@peace start` — start capturing this text channel',
  '`@peace join` — join your voice channel and transcribe (I will announce myself)',
  '`@peace summarize` / `decisions` / `actions` / `questions` / `diagram` — generate from the transcript so far',
  '`@peace stop` — end the meeting and generate final artifacts'
].join('\n');

let generator: StructuredGenerator | null = null;

function getGenerator (): StructuredGenerator {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured — artifact generation is disabled.');
  }

  generator ??= createAiGenerator(getDefaultModel());

  return generator;
}

const ARTIFACT_FOR_INTENT: Partial<Record<CommandIntent, ArtifactType>> = {
  summarize: 'summary',
  decisions: 'decisions',
  actions  : 'action-items',
  questions: 'open-questions',
  diagram  : 'diagram'
};

/**
 * Run the pipeline over the transcript so far and render the requested
 * artifact as a Discord-flavored reply.
 */
export async function generateReply (db: PeaceDb, meetingId: string, intent: CommandIntent): Promise<string> {
  const type = ARTIFACT_FOR_INTENT[intent];

  if (!type) {
    throw new Error(`intent ${intent} does not map to an artifact`);
  }

  if (getSegments(db, meetingId).length === 0) {
    return 'I have not captured anything yet — say something (or `@peace join` a voice channel) and ask again.';
  }

  const { artifacts } = await runPipeline(db, meetingId, getGenerator());
  const artifact = artifacts.find(item => item.type === type);

  return artifact ? renderArtifact(artifact) : 'Generation finished but produced nothing for that — try again with more conversation.';
}

export function renderArtifact (artifact: Artifact): string {
  const parsed = parseArtifactContent(artifact.type, artifact.content);

  switch (parsed.type) {
    case 'summary':
      return `**Summary** (v${artifact.version})\n${parsed.content.markdown}`;

    case 'diagram':
      return `**${artifact.title}** (v${artifact.version})\n\`\`\`mermaid\n${parsed.content.mermaid}\n\`\`\``;

    case 'action-items': {
      const lines = parsed.content.items.map(item => `- [ ] ${item.description}${item.assignee ? ` — **${item.assignee}**` : ''}${item.dueDate ? ` (due ${item.dueDate})` : ''}${item.uncertain ? ' *(uncertain)*' : ''}`);

      return `**Action items** (v${artifact.version})\n${lines.join('\n') || '_none yet_'}`;
    }

    case 'decisions': {
      const lines = parsed.content.items.map(item => `- ${item.description}${item.rationale ? ` — _${item.rationale}_` : ''}${item.uncertain ? ' *(uncertain)*' : ''}`);

      return `**Decisions** (v${artifact.version})\n${lines.join('\n') || '_none yet_'}`;
    }

    case 'open-questions': {
      const lines = parsed.content.items.map(item => `- ${item.question}${item.uncertain ? ' *(uncertain)*' : ''}`);

      return `**Open questions** (v${artifact.version})\n${lines.join('\n') || '_none yet_'}`;
    }

    case 'key-points': {
      const lines = parsed.content.items.map(item => `- ${item.point}${item.uncertain ? ' *(uncertain)*' : ''}`);

      return `**Key points** (v${artifact.version})\n${lines.join('\n') || '_none yet_'}`;
    }

    default:
      return 'Unknown artifact type.';
  }
}
