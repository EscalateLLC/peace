# Changesets

Change management for the peace monorepo. Full docs: https://github.com/changesets/changesets

## The rule

**Any commit that touches `apps/*` or `packages/*` must include a changeset** (enforced by
the pre-commit hook and, once a remote exists, CI).

- `pnpm changeset` — describe your change and pick a bump (`patch` / `minor` / `major`).
  The bump intent lives here: minor/major changes can never land undocumented.
- `pnpm changeset add --empty` — explicit opt-out for changes that warrant no release
  note (chores, test-only changes, refactors with no observable effect).

## Versioning model

All `@peace/*` packages version in **lockstep** (one product version) via the `fixed`
group — nothing is published to npm; versions exist for changelogs and history.

`pnpm version-packages` consumes pending changesets, bumps every package + the repo
root, writes per-package `CHANGELOG.md`s, and aggregates a product-level entry into the
root `CHANGELOG.md`.
