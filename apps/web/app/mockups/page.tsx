import Link from 'next/link';

/* The mockups gallery. The lead is the workspace-driven rethink: the diagram /
 * organizational canvas as the hero, multiplayer + the peace agent as
 * first-class. Earlier explorations (transcript-reader, outcome-board, and the
 * four styling skins) are kept below for reference. Standalone — no db, no
 * pipeline, no packages/ui. */

interface Card {
  slug: string;
  tag: string;
  name: string;
  intent: string;
  blurb: string;
  swatches: string[];
  bg: string;
  font: string;
  fontVar: string;
  serif?: boolean;
}

const LEAD: Card = {
  slug    : 'deck',
  tag     : '★',
  name    : 'Command Deck',
  intent  : 'game-HUD · spring swap · expand · keyboard',
  blurb   : 'Three HUD panels — comms · workflow · actions — focal (widest) in the MIDDLE by default (L/C/R). Click a panel and it SWAPS into the focal slot on a real spring (rAF, GPU x/y/w/h — they slide past each other); click the focal one again (or Enter) and it EXPANDS to an inset-fullscreen over a backdrop (DOCK / Esc / click-out to return). ←/→ cycle the focal panel; drag the seams to resize (grabs on first press). Whole panel is the move target on empty space (grip lights); a real control lights instead. Click a node for its inspector — comment / ask peace / link — while transcript + actions cross-light its evidence. The locked interaction prototype.',
  swatches: ['oklch(0.14 0.012 250)', 'oklch(0.84 0.12 205)', 'oklch(0.82 0.15 75)', 'oklch(0.8 0.16 150)'],
  bg      : 'linear-gradient(150deg, oklch(0.16 0.014 250), oklch(0.13 0.012 250)), repeating-linear-gradient(0deg, transparent 0 7px, oklch(0.84 0.12 205 / 0.04) 7px 8px)',
  font    : 'var(--font-mono)',
  fontVar : 'three-panel interchange · cross-linked · multiplayer'
};

const WORKSPACES: Card[] = [
  {
    slug    : 'atlas',
    tag     : '01',
    name    : 'Atlas',
    intent  : 'canvas-first · the diagram IS the workspace',
    blurb   : 'The conversation organizes itself into a living node-map — topics, decisions, actions, questions wired together as they form. Everything else floats over it: multiplayer cursors, a collapsible transcript dock for evidence, and a peace command bar to talk to the bot or run AI actions. Click a node for its evidence + what you can do with it.',
    swatches: ['oklch(0.16 0.008 260)', 'oklch(0.79 0.14 72)', 'oklch(0.74 0.13 152)', 'oklch(0.74 0.13 230)'],
    bg      : 'radial-gradient(120% 120% at 75% 0%, oklch(0.22 0.02 260), transparent 60%), oklch(0.16 0.008 260)',
    font    : 'var(--font-fraunces)',
    fontVar : 'infinite canvas · floating chrome',
    serif   : true
  },
  {
    slug    : 'studio',
    tag     : '02',
    name    : 'Studio',
    intent  : 'structured cockpit · canvas + a peace you talk to',
    blurb   : 'Same living diagram as the hero, framed as mission control: a presence + transcript rail (who is here, the source), the canvas dominating the center, and a peace agent console on the right where you converse and dispatch actions. Selecting a node ties all three together — highlights its evidence, loads its actions. Docked and legible where Atlas floats.',
    swatches: ['oklch(0.165 0.008 260)', 'oklch(0.79 0.14 72)', 'oklch(0.74 0.13 152)', 'oklch(0.74 0.13 230)'],
    bg      : 'radial-gradient(120% 120% at 20% 0%, oklch(0.21 0.02 260), transparent 60%), oklch(0.165 0.008 260)',
    font    : 'var(--font-fraunces)',
    fontVar : 'docked rails · agent console',
    serif   : true
  }
];

const EXPLORED: Card[] = [
  {
    slug    : 'command',
    tag     : '·',
    name    : 'Command',
    intent  : '',
    blurb   : 'Game-HUD with the diagram as fullscreen world + corner widgets. (Diagram too central.)',
    swatches: ['oklch(0.14 0.012 250)', 'oklch(0.84 0.12 205)', 'oklch(0.82 0.15 75)', 'oklch(0.8 0.16 150)'],
    bg      : 'oklch(0.14 0.012 250)',
    font    : 'var(--font-mono)',
    fontVar : ''
  },
  {
    slug    : 'fluid',
    tag     : '·',
    name    : 'Fluid Studio',
    intent  : '',
    blurb   : 'Focus one zone; others recede to rails. (Panels hid + moved too much.)',
    swatches: ['oklch(0.165 0.008 260)', 'oklch(0.79 0.14 72)', 'oklch(0.74 0.13 152)', 'oklch(0.74 0.13 230)'],
    bg      : 'oklch(0.165 0.008 260)',
    font    : 'var(--font-fraunces)',
    fontVar : '',
    serif   : true
  },
  {
    slug    : 'stream',
    tag     : '·',
    name    : 'Stream',
    intent  : '',
    blurb   : 'One living document; insights crystallize inline. (Felt like a reader.)',
    swatches: ['oklch(0.965 0.01 80)', 'oklch(0.55 0.15 35)', 'oklch(0.5 0.11 150)', 'oklch(0.7 0.01 55)'],
    bg      : 'oklch(0.965 0.01 80)',
    font    : 'var(--font-newsreader)',
    fontVar : '',
    serif   : true
  },
  {
    slug    : 'brief',
    tag     : '·',
    name    : 'Brief',
    intent  : '',
    blurb   : 'Outcomes-first, transcript on demand. (Felt like a dashboard.)',
    swatches: ['oklch(0.17 0.011 64)', 'oklch(0.79 0.14 72)', 'oklch(0.72 0.11 152)', 'oklch(0.66 0.16 48)'],
    bg      : 'oklch(0.17 0.011 64)',
    font    : 'var(--font-fraunces)',
    fontVar : '',
    serif   : true
  },
  {
    slug    : 'calm',
    tag     : 'A',
    name    : 'Calm Observatory',
    intent  : '',
    blurb   : 'Skin: near-black, aurora-teal, glass.',
    swatches: ['oklch(0.13 0.012 264)', 'oklch(0.82 0.16 165)', 'oklch(0.78 0.1 85)', 'oklch(0.205 0.016 264)'],
    bg      : 'oklch(0.13 0.012 264)',
    font    : 'var(--font-hanken)',
    fontVar : ''
  },
  {
    slug    : 'editorial',
    tag     : 'B',
    name    : 'Warm Editorial',
    intent  : '',
    blurb   : 'Skin: paper-warm, serif, spread.',
    swatches: ['oklch(0.965 0.009 85)', 'oklch(1 0 0)', 'oklch(0.55 0.19 35)', 'oklch(0.24 0.018 60)'],
    bg      : 'oklch(0.965 0.009 85)',
    font    : 'var(--font-newsreader)',
    fontVar : '',
    serif   : true
  },
  {
    slug    : 'signal',
    tag     : 'C',
    name    : 'Expressive Signal',
    intent  : '',
    blurb   : 'Skin: violet field, per-speaker color.',
    swatches: ['oklch(0.15 0.03 290)', 'oklch(0.76 0.17 200)', 'oklch(0.76 0.17 330)', 'oklch(0.93 0.06 290)'],
    bg      : 'linear-gradient(150deg, oklch(0.17 0.05 290), oklch(0.145 0.04 225) 60%, oklch(0.15 0.045 295))',
    font    : 'var(--font-unbounded)',
    fontVar : ''
  },
  {
    slug    : 'warm-signal',
    tag     : 'D',
    name    : 'Warm Signal',
    intent  : '',
    blurb   : 'Skin: warm-dark manuscript, ember.',
    swatches: ['oklch(0.165 0.011 64)', 'oklch(0.79 0.14 72)', 'oklch(0.66 0.16 48)', 'oklch(0.23 0.015 56)'],
    bg      : 'radial-gradient(120% 120% at 80% 0%, oklch(0.26 0.05 64 / 0.6), transparent 56%), oklch(0.165 0.011 64)',
    font    : 'var(--font-fraunces)',
    fontVar : '',
    serif   : true
  }
];

export default function MockupsGallery () {
  return (
    <div className="g-root">
      <style>{CSS}</style>

      <header className="g-head">
        <Link
          href="/"
          className="g-home"
        >
          ← peace
        </Link>
        <h1 className="g-title">Command Deck — three panels, game-UI</h1>
        <p className="g-sub">
          The original three-pane — <em>transcript · workflow · actions</em> — working together, none the
          centerpiece, wearing a <em>game-HUD</em> skin that&apos;s easy and cool to use. Panels stay put and light
          up on hover; click one to fly it to center, then dock. They&apos;re cross-linked: click a node and the
          transcript + actions react; click a line and the nodes that cite it light up.
        </p>
      </header>

      <Link
        href={`/mockups/${LEAD.slug}`}
        className="g-card g-card-lead"
        style={{ background: LEAD.bg }}
      >
        <div className="g-lead-text">
          <div className="g-card-top">
            <span className="g-tag g-tag-lead">{LEAD.tag}</span>
            <div className="g-swatches">
              {LEAD.swatches.map((s, i) => (
                <span
                  key={i}
                  className="g-sw"
                  style={{ background: s }}
                />
              ))}
            </div>
          </div>
          <div className="g-intent">{LEAD.intent}</div>
          <h2
            className="g-name g-name-serif g-name-lead"
            style={{ fontFamily: LEAD.font }}
          >
            {LEAD.name}
          </h2>
          <p className="g-blurb">{LEAD.blurb}</p>
          <span className="g-fontline">{LEAD.fontVar}</span>
          <span className="g-open g-open-lead">Open workspace →</span>
        </div>
        <div className="g-lead-art">
          <div className="g-art-rail">T</div>
          <div className="g-art-hero">
            <span className="g-art-node g-art-d" />
            <span className="g-art-node g-art-a" />
            <span className="g-art-node g-art-q" />
          </div>
          <div className="g-art-rail">✦</div>
        </div>
      </Link>

      <div className="g-divider">
        <span>The two bases it composes — explore each</span>
      </div>

      <div className="g-grid g-grid-hero">
        {WORKSPACES.map(c => (
          <Link
            key={c.slug}
            href={`/mockups/${c.slug}`}
            className="g-card g-card-hero"
            style={{ background: c.bg }}
          >
            <div className="g-card-top">
              <span className="g-tag">{c.tag}</span>
              <div className="g-swatches">
                {c.swatches.map((s, i) => (
                  <span
                    key={i}
                    className="g-sw"
                    style={{ background: s }}
                  />
                ))}
              </div>
            </div>
            <div className="g-intent">{c.intent}</div>
            <h2
              className={`g-name${c.serif ? ' g-name-serif' : ''}`}
              style={{ fontFamily: c.font }}
            >
              {c.name}
            </h2>
            <p className="g-blurb">{c.blurb}</p>
            <span className="g-fontline">{c.fontVar}</span>
            <span className="g-open">Open workspace →</span>
          </Link>
        ))}
      </div>

      <div className="g-divider">
        <span>Earlier explorations — for reference</span>
      </div>

      <div className="g-grid g-grid-mini">
        {EXPLORED.map(c => (
          <Link
            key={c.slug}
            href={`/mockups/${c.slug}`}
            className="g-card g-card-mini"
            style={{ background: c.bg }}
          >
            <div className="g-card-top">
              <span className="g-tag g-tag-sm">{c.tag}</span>
              <div className="g-swatches">
                {c.swatches.map((s, i) => (
                  <span
                    key={i}
                    className="g-sw g-sw-sm"
                    style={{ background: s }}
                  />
                ))}
              </div>
            </div>
            <h2
              className={`g-name g-name-sm${c.serif ? ' g-name-serif' : ''}`}
              style={{ fontFamily: c.font }}
            >
              {c.name}
            </h2>
            <p className="g-blurb g-blurb-sm">{c.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

const CSS = `
.g-root {
  position: absolute; inset: 0; overflow-y: auto;
  font-family: var(--font-hanken), system-ui, sans-serif;
  color: oklch(0.85 0.01 264);
  background:
    radial-gradient(900px 500px at 50% -10%, oklch(0.22 0.04 280 / 0.4), transparent 60%),
    oklch(0.12 0.01 264);
  padding: 56px 40px 80px;
}
.g-head { max-width: 1100px; margin: 0 auto 38px; }
.g-home { font-size: 13px; color: oklch(0.6 0.02 264); text-decoration: none; transition: color 160ms; }
.g-home:hover { color: oklch(0.85 0.05 165); }
.g-title { font-size: 34px; font-weight: 600; color: oklch(0.96 0.01 264); margin: 18px 0 12px; letter-spacing: -0.02em; }
.g-sub { font-size: 15px; line-height: 1.62; color: oklch(0.66 0.02 264); max-width: 740px; }
.g-sub em { color: oklch(0.88 0.06 70); font-style: normal; }

.g-grid { max-width: 1100px; margin: 0 auto; display: grid; gap: 22px; }
.g-grid-hero { grid-template-columns: repeat(2, 1fr); }
.g-grid-mini { grid-template-columns: repeat(3, 1fr); gap: 14px; }

.g-card {
  position: relative; display: flex; flex-direction: column;
  border-radius: 18px; border: 1px solid oklch(1 0 0 / 0.09);
  text-decoration: none; color: inherit; overflow: hidden;
  transition: transform 260ms cubic-bezier(0.2,0,0,1), box-shadow 260ms, border-color 260ms;
}
.g-card:hover { transform: translateY(-4px); box-shadow: 0 24px 60px -24px oklch(0 0 0 / 0.7); border-color: oklch(1 0 0 / 0.22); }
.g-card-lead { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 1.15fr 0.85fr; min-height: 300px; }
.g-lead-text { padding: 30px 32px; display: flex; flex-direction: column; }
.g-tag-lead { background: var(--g-amber, oklch(0.79 0.14 72)); color: oklch(0.16 0.01 260); }
.g-name-lead { font-size: 38px; }
.g-open-lead { color: oklch(0.88 0.06 72); }
.g-lead-art { position: relative; display: flex; gap: 8px; padding: 22px; border-left: 1px solid oklch(1 0 0 / 0.08); }
.g-art-rail { width: 40px; flex-shrink: 0; border-radius: 10px; background: oklch(1 0 0 / 0.04); border: 1px solid oklch(1 0 0 / 0.06); display: flex; align-items: center; justify-content: center; color: oklch(0.7 0.02 260); font-size: 14px; }
.g-art-hero { position: relative; flex: 1; border-radius: 12px; background: oklch(0.14 0.008 260); border: 1px solid oklch(1 0 0 / 0.08); background-image: radial-gradient(oklch(1 0 0 / 0.05) 1px, transparent 1px); background-size: 18px 18px; overflow: hidden; }
.g-art-node { position: absolute; border-radius: 7px; }
.g-art-d { width: 46%; height: 20px; left: 27%; top: 30%; background: oklch(0.79 0.14 72 / 0.3); border: 1px solid oklch(0.79 0.14 72); box-shadow: 0 0 18px oklch(0.79 0.14 72 / 0.4); animation: g-float 4s ease-in-out infinite; }
.g-art-a { width: 38%; height: 16px; left: 50%; top: 62%; background: oklch(0.74 0.13 152 / 0.25); border: 1px solid oklch(0.74 0.13 152); }
.g-art-q { width: 34%; height: 16px; left: 12%; top: 60%; background: oklch(0.74 0.13 230 / 0.22); border: 1px solid oklch(0.74 0.13 230); }
@keyframes g-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
.g-card-hero { min-height: 340px; padding: 26px 26px 22px; }
.g-card-mini { min-height: 132px; padding: 15px 16px 13px; border-radius: 13px; }

.g-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.g-tag {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 10px;
  background: oklch(1 0 0 / 0.1); color: oklch(0.96 0.01 264);
  font-size: 13px; font-weight: 700; backdrop-filter: blur(8px); letter-spacing: 0.02em;
}
.g-tag-sm { width: 24px; height: 24px; border-radius: 7px; font-size: 11px; }
.g-swatches { display: flex; gap: 6px; }
.g-sw { width: 18px; height: 18px; border-radius: 6px; box-shadow: inset 0 0 0 1px oklch(1 0 0 / 0.14); }
.g-sw-sm { width: 12px; height: 12px; border-radius: 4px; }

.g-intent {
  font-family: var(--font-mono); font-size: 11.5px; letter-spacing: 0.01em;
  color: oklch(0.86 0.06 72); margin-bottom: 10px; text-shadow: 0 1px 12px oklch(0 0 0 / 0.5);
}
.g-name { font-size: 30px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 10px; color: oklch(0.98 0.008 264); text-shadow: 0 1px 20px oklch(0 0 0 / 0.45); }
.g-name-serif { font-weight: 500; }
.g-name-sm { font-size: 15px; margin-bottom: 5px; }
.g-blurb { font-size: 13.5px; line-height: 1.58; color: oklch(0.84 0.015 264 / 0.94); max-width: 48ch; text-shadow: 0 1px 12px oklch(0 0 0 / 0.55); }
.g-blurb-sm { font-size: 11.5px; line-height: 1.4; opacity: 0.85; }
.g-fontline { margin-top: auto; padding-top: 18px; font-family: var(--font-mono); font-size: 11px; color: oklch(0.82 0.015 264 / 0.72); }
.g-open { margin-top: 8px; font-size: 13px; font-weight: 600; color: oklch(0.95 0.02 264); opacity: 0; transform: translateX(-4px); transition: all 220ms; }
.g-card-hero:hover .g-open { opacity: 1; transform: none; }

.g-divider {
  max-width: 1100px; margin: 46px auto 22px; display: flex; align-items: center; gap: 16px;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: oklch(0.55 0.02 264);
}
.g-divider::after { content: ''; flex: 1; height: 1px; background: oklch(1 0 0 / 0.08); }

@media (max-width: 900px) { .g-grid-hero { grid-template-columns: 1fr; } .g-grid-mini { grid-template-columns: repeat(2, 1fr); } }
`;
