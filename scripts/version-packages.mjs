// Lockstep version cut: aggregate pending changesets into the root CHANGELOG,
// run `changeset version` (per-package CHANGELOGs + bumps), then sync the root
// package.json to the shared product version. Zero deps — plain Node.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const changesetDir = path.join(root, '.changeset');

// ── 1. Parse pending changesets (before `changeset version` consumes them) ──
const pending = readdirSync(changesetDir)
  .filter(f => f.endsWith('.md') && f !== 'README.md')
  .map(f => {
    const raw = readFileSync(path.join(changesetDir, f), 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

    if (!match) {
      return null;
    }
    const releases = [...match[1].matchAll(/^['"]?(@?[\w/-]+)['"]?\s*:\s*(major|minor|patch)\s*$/gm)]
      .map(([, pkg, bump]) => ({
        pkg,
        bump
      }));

    return {
      releases,
      summary: match[2].trim()
    };
  })
  .filter(c => c && c.releases.length > 0); // empty changesets carry no release note

if (pending.length === 0) {
  console.log('No pending changesets — nothing to version.');
  process.exit(0);
}

// ── 2. Let changesets do the real work ──────────────────────────────────────
execSync('pnpm exec changeset version', { stdio: 'inherit' });

// ── 3. Sync the root package.json to the lockstep product version ───────────
const corePkgPath = path.join(root, 'packages', 'core', 'package.json');
const version = JSON.parse(readFileSync(corePkgPath, 'utf8')).version;
const rootPkgPath = path.join(root, 'package.json');
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
rootPkg.version = version;
writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`);

// ── 4. Prepend the aggregated product entry to the root CHANGELOG ───────────
const order = {
  major: 0,
  minor: 1,
  patch: 2
};
const heading = {
  major: 'Major changes',
  minor: 'Minor changes',
  patch: 'Patch changes'
};
const byBump = new Map([['major', []], ['minor', []], ['patch', []]]);

for (const { releases, summary } of pending) {
  const top = releases.reduce((a, b) => (order[a.bump] <= order[b.bump] ? a : b)).bump;
  const pkgs = releases.map(r => `\`${r.pkg}\``).join(', ');
  byBump.get(top).push(`- ${summary} (${pkgs})`);
}

const date = new Date().toISOString()
  .slice(0, 10);
const section = [`## ${version} — ${date}`];

for (const bump of ['major', 'minor', 'patch']) {
  const items = byBump.get(bump);

  if (items.length === 0) {
    continue;
  }
  section.push('', `### ${heading[bump]}`, '', ...items);
}

const changelogPath = path.join(root, 'CHANGELOG.md');
const existing = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8').replace(/^# peace\r?\n+/, '') : '';
writeFileSync(changelogPath, `${`# peace\n\n${section.join('\n')}\n\n${existing}`.trimEnd()}\n`);

console.log(`\nVersioned peace → ${version}; root CHANGELOG.md updated.`);
console.log(`Review the diff, then ask for a commit (and tag, e.g. v${version}) when ready.`);
