/**
 * Shared stub conversation for the design-direction mockups.
 *
 * NOT real data and NOT wired to the db/pipeline — a single hand-authored live
 * moment (a product team scoping a beta) so every direction renders identical
 * content and only the *design language* differs. Mirrors the real shapes
 * (segments with interim/confidence, evidence-linked artifacts) closely enough
 * that porting a winning direction into packages/ui is a translation, not a
 * redesign.
 */

export interface MockSegment {
  id: string;
  speaker: string;

  /** Stable id for speaker color assignment. */
  speakerId: string;

  /** ms since meeting start. */
  t: number;
  text: string;

  /** Streaming, not yet committed — renders in the "still forming" state. */
  interim?: boolean;

  /** 0..1; <0.7 renders the low-confidence cue. */
  confidence?: number;

  /** peace's own turns — rendered as the bot, excluded from speaker palette. */
  bot?: boolean;
}

export interface MockDecision {
  id: string;
  text: string;
  rationale?: string;
  evidence: string[];

  /** Just extracted, not yet confirmed — the crystallization beat. */
  provisional?: boolean;
}

export interface MockAction {
  id: string;
  text: string;
  assignee?: string;
  due?: string;
  evidence: string[];
  provisional?: boolean;
}

export interface MockItem {
  id: string;
  text: string;
  evidence: string[];
}

export const MEETING = {
  title   : 'Northwind — beta scope sync',
  platform: 'discord',
  elapsed : '07:21',

  /** who holds the floor right now (speakerId), and what peace is doing. */
  speakingId: 'devin',
  botState  : 'listening' as 'listening' | 'thinking' | 'speaking'
};

/** Speakers present, in join order. peace is staff, not cast. */
export const SPEAKERS = [
  {
    id   : 'maya',
    name : 'Maya Chen',
    short: 'Maya',
    role : 'PM'
  },
  {
    id   : 'devin',
    name : 'Devin Okafor',
    short: 'Devin',
    role : 'Eng'
  },
  {
    id   : 'priya',
    name : 'Priya Raman',
    short: 'Priya',
    role : 'Design'
  }
];

export const SEGMENTS: MockSegment[] = [
  {
    id       : 's1',
    speaker  : 'Maya Chen',
    speakerId: 'maya',
    t        : 372_000,
    text     : 'Okay — the one open question for the beta. Do we ship live transcription, or hold it for v2?'
  },
  {
    id       : 's2',
    speaker  : 'Devin Okafor',
    speakerId: 'devin',
    t        : 380_000,
    text     : 'I lean toward holding. The per-speaker streaming socket is solid in testing, but we have not load-tested past four concurrent speakers.'
  },
  {
    id       : 's3',
    speaker  : 'Priya Raman',
    speakerId: 'priya',
    t        : 391_000,
    text     : 'But the live view is the whole reason a stranger says wow. Batch feels like a different, lesser product.'
  },
  {
    id       : 's4',
    speaker  : 'Maya Chen',
    speakerId: 'maya',
    t        : 400_000,
    text     : 'Fair. Priya — what is the minimum that still feels live?'
  },
  {
    id        : 's5',
    speaker   : 'Priya Raman',
    speakerId : 'priya',
    t         : 406_000,
    text      : 'Honestly? The transcript streaming in, and one insight landing. We do not need all six artifact types live for the demo.',
    confidence: 0.62
  },
  {
    id       : 's6',
    speaker  : 'Devin Okafor',
    speakerId: 'devin',
    t        : 415_000,
    text     : 'If we scope it to live transcript plus live decisions, I can guarantee that path under load. Everything else stays batch on stop.'
  },
  {
    id       : 's7',
    speaker  : 'Maya Chen',
    speakerId: 'maya',
    t        : 424_000,
    text     : 'I like that. So the decision is: beta ships live transcript and live decisions, everything else batch.'
  },
  {
    id       : 's8',
    speaker  : 'peace',
    speakerId: 'peace',
    t        : 431_000,
    bot      : true,
    text     : 'Want me to log that? I have it as: live transcript plus live decisions ship in the beta, the other four artifact types generate on stop.'
  },
  {
    id       : 's9',
    speaker  : 'Maya Chen',
    speakerId: 'maya',
    t        : 437_000,
    text     : 'Yes — log it.'
  },
  {
    id       : 's10',
    speaker  : 'Devin Okafor',
    speakerId: 'devin',
    t        : 441_000,
    interim  : true,
    text     : 'And put an action on me to load-test the four-speaker path before we'
  }
];

export const DECISIONS: MockDecision[] = [
  {
    id         : 'd2',
    text       : 'Beta ships live transcript and live decisions; the other four artifact types generate in batch on stop.',
    rationale  : 'Guarantees the live path under load (Devin) while keeping the live "wow" that makes the product (Priya).',
    evidence   : ['s5', 's6', 's7'],
    provisional: true
  },
  {
    id       : 'd1',
    text     : 'Use per-speaker streaming STT sockets, not one mixed-audio socket.',
    rationale: 'Cleaner diarization; matches the platform×medium capture model.',
    evidence : ['s2']
  }
];

export const ACTIONS: MockAction[] = [
  {
    id         : 'a2',
    text       : 'Load-test the streaming pipeline past four concurrent speakers.',
    assignee   : 'Devin',
    due        : 'Fri',
    evidence   : ['s2', 's6'],
    provisional: true
  },
  {
    id      : 'a1',
    text    : 'Draft the beta scope note for the live-transcript + decisions cut.',
    assignee: 'Maya',
    evidence: ['s7']
  }
];

export const QUESTIONS: MockItem[] = [
  {
    id      : 'q1',
    text    : 'What is the minimum live surface that still feels "live" to a stranger?',
    evidence: ['s4', 's5']
  }
];

export const KEY_POINTS: MockItem[] = [
  {
    id      : 'k1',
    text    : 'The live view is the core wow; batch reads as a lesser product.',
    evidence: ['s3']
  },
  {
    id      : 'k2',
    text    : 'Streaming socket is proven to four speakers; unverified beyond.',
    evidence: ['s2']
  }
];

export const SUMMARY_MD = `The team scoped the public beta's **live surface**. Live transcript and live decisions ship in the beta; the remaining four artifact types generate in batch when the meeting stops — the cut Devin can guarantee under load and Priya accepts as still genuinely live.

Underneath sits an earlier call to run **per-speaker streaming sockets** rather than one mixed-audio stream.`;

/** mm:ss from ms. */
export function offset (ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;

  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Stable 0..7 palette slot per speaker (peace is handled separately). */
export function speakerSlot (speakerId: string): number {
  let hash = 0;

  for (const char of speakerId) {
    hash = (hash * 31 + char.codePointAt(0)!) % 997;
  }

  return hash % 8;
}

/* ----------------------------------------------------------------------------
 * Workspace canvas — the organizational diagram the conversation builds itself
 * into. This is the product's centerpiece: nodes are the structure peace
 * extracts (topics, decisions, actions, questions), positioned on a stage and
 * wired by edges. Used by the canvas-driven layout mockups.
 * ------------------------------------------------------------------------- */

export type NodeKind = 'topic' | 'decision' | 'action' | 'question' | 'outcome';

export interface MapNode {
  id: string;
  kind: NodeKind;
  label: string;

  /** center position on the 980×640 stage. */
  x: number;
  y: number;
  w: number;
  evidence?: string[];

  /** just formed — gets the arrival/crystallize treatment. */
  provisional?: boolean;
}

export const NODES: MapNode[] = [
  {
    id      : 'topic',
    kind    : 'topic',
    label   : 'Beta scope: ship live transcription?',
    x       : 490,
    y       : 74,
    w       : 248,
    evidence: ['s1']
  },
  {
    id      : 'q1',
    kind    : 'question',
    label   : 'Minimum surface that still feels live?',
    x       : 196,
    y       : 226,
    w       : 196,
    evidence: ['s4', 's5']
  },
  {
    id      : 'd1',
    kind    : 'decision',
    label   : 'Per-speaker STT sockets',
    x       : 786,
    y       : 210,
    w       : 188,
    evidence: ['s2']
  },
  {
    id         : 'd2',
    kind       : 'decision',
    label      : 'Beta ships live transcript + live decisions',
    x          : 490,
    y          : 268,
    w          : 240,
    evidence   : ['s5', 's6', 's7'],
    provisional: true
  },
  {
    id      : 'batch',
    kind    : 'outcome',
    label   : 'Other 4 artifact types → batch on stop',
    x       : 320,
    y       : 446,
    w       : 210,
    evidence: ['s6']
  },
  {
    id         : 'a2',
    kind       : 'action',
    label      : 'Load-test past 4 concurrent speakers',
    x          : 638,
    y          : 446,
    w          : 206,
    evidence   : ['s2', 's6'],
    provisional: true
  },
  {
    id      : 'a1',
    kind    : 'action',
    label   : 'Draft the beta scope note',
    x       : 490,
    y       : 576,
    w       : 184,
    evidence: ['s7']
  }
];

/** [from, to] node-id pairs. */
export const EDGES: [string, string][] = [
  ['topic', 'd2'],
  ['topic', 'd1'],
  ['q1', 'd2'],
  ['d2', 'batch'],
  ['d2', 'a2'],
  ['d1', 'a2'],
  ['d2', 'a1']
];

/** People in the workspace right now (peace is staff; "you" is the viewer). */
export interface Collaborator {
  id: string;
  name: string;
  short: string;
  color: string;

  /** live cursor position on the stage, if visible. */
  cursor?: { x: number; y: number };

  /** node id this person currently has selected/focused. */
  focus?: string;
  speaking?: boolean;
  you?: boolean;
}

export const COLLABORATORS: Collaborator[] = [
  {
    id    : 'maya',
    name  : 'Maya Chen',
    short : 'MC',
    color : 'oklch(0.74 0.15 230)',
    cursor: {
      x: 556,
      y: 318
    },
    focus: 'd2'
  },
  {
    id    : 'priya',
    name  : 'Priya Raman',
    short : 'PR',
    color : 'oklch(0.74 0.16 340)',
    cursor: {
      x: 250,
      y: 286
    },
    focus: 'q1'
  },
  {
    id      : 'devin',
    name    : 'Devin Okafor',
    short   : 'DO',
    color   : 'oklch(0.78 0.15 90)',
    speaking: true
  },
  {
    id   : 'you',
    name : 'You',
    short: 'You',
    color: 'oklch(0.8 0.02 70)',
    you  : true
  }
];

/** A short peace exchange + the AI actions the workspace can dispatch. */
export interface AgentTurn {
  from: 'peace' | 'user';
  text: string;
}

export const AGENT_THREAD: AgentTurn[] = [
  {
    from: 'user',
    text: '@peace turn the scope decision into a ticket and draft the note'
  },
  {
    from: 'peace',
    text: 'On it. I’ve drafted the beta-scope note from the decision and Priya’s "minimum live surface" point, and opened a ticket for Devin’s load-test. Want me to post the note to #northwind?'
  }
];

export interface AgentAction {
  icon: string;
  label: string;
  hint?: string;
}

export const AGENT_ACTIONS: AgentAction[] = [
  {
    icon : '◆',
    label: 'Make decision a ticket',
    hint : 'Linear'
  },
  {
    icon : '✉',
    label: 'Draft the scope note',
    hint : 'from evidence'
  },
  {
    icon : '▸',
    label: 'Assign the load-test',
    hint : '@Devin'
  },
  {
    icon : '✨',
    label: 'Summarize open questions'
  }
];
