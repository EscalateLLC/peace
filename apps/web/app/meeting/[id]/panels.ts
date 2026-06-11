// The deck's panels — shared by the layout strategies + the workspace render.

export type PanelId = 'comms' | 'workflow' | 'summary';

export const PANELS: { id: PanelId; title: string }[] = [
  {
    id   : 'comms',
    title: 'Conversation'
  },
  {
    id   : 'workflow',
    title: 'Workflow'
  },
  {
    id   : 'summary',
    title: 'Summary'
  }
];

export const IDS: readonly PanelId[] = PANELS.map(p => p.id);
