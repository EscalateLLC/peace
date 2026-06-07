// Pre-commit gate: a commit that touches package/app source must carry a
// changeset (a real one, or an explicit `pnpm changeset add --empty` opt-out).
// The bump intent lives in the changeset — this is what guarantees minor/major
// changes never land undocumented. Zero deps — plain Node.
import { execSync } from 'node:child_process';
import process from 'node:process';

const staged = execSync('git diff --cached --name-only --diff-filter=ACMRD', { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean);

const touchesSource = staged.some(
  f => /^(apps|packages)\//.test(f) && !/(^|\/)CHANGELOG\.md$/.test(f)
);

// Any staged changeset counts — including deletions, so the `version-packages`
// commit (which consumes changesets) passes naturally.
const hasChangeset = staged.some(f => /^\.changeset\/.+\.md$/.test(f) && !f.endsWith('README.md'));

if (touchesSource && !hasChangeset) {
  console.error(
    [
      '✖ This commit changes apps/ or packages/ but includes no changeset.',
      '',
      '  pnpm changeset              describe the change + pick patch/minor/major',
      '  pnpm changeset add --empty  explicit opt-out (chore / test-only / no release note)',
      '',
      '  then `git add .changeset` and commit again.'
    ].join('\n')
  );
  process.exit(1);
}
