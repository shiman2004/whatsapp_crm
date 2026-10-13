# CI / Quality Gates

This document explains the continuous integration setup added in branch `ci/add-quality-gates`.

---

## What was added

```
.github/
└── workflows/
    └── quality-gates.yml   ← the only new file
```

No existing files were modified.

---

## Workflow overview

**File:** [`.github/workflows/quality-gates.yml`](.github/workflows/quality-gates.yml)

Triggers on every **push** to `main`, `feat/**`, `fix/**`, `ci/**`, `chore/**` and on every **pull request targeting `main`**.

### Jobs

| Job | What it does | Blocks merge? |
|-----|-------------|---------------|
| **Frontend** | `npm ci` → `tsc -b --noEmit` → `oxlint` → `vite build` → upload dist artifact | ✅ Yes |
| **Backend** | `npm ci` → `prisma generate` → all 37 security & auth tests | ✅ Yes |
| **Dependency Audit** | `npm audit --audit-level=critical` on root, backend, frontend; prints advisory table | Only on CRITICAL CVEs |
| **Secret Leak Scan** | grep for live Meta tokens (EAAP...) and embedded DB passwords in git-tracked files | ✅ Yes |

---

## What the CI does NOT do

- **No automatic deployment.** Render's own build hook on `main` handles production. This workflow never calls `render deploy` or any deployment API.
- **No forced dependency upgrades.** The audit job documents vulnerabilities but uses `--audit-level=critical` so known high-severity build-tool CVEs (see below) don't block day-to-day CI.
- **No secret exposure.** All env vars in the workflow are non-secret CI stubs (`ci-placeholder-meta-token`, etc.). Real secrets live exclusively in Render's environment dashboard.

---

## Permissions (least-privilege)

```yaml
permissions:
  contents: read        # read source — never write to the repo
  checks: write         # post check results into the PR UI
  pull-requests: write  # add annotation comments to PRs
```

---

## Node.js version pinning

The workflow pins **Node 24** (`node-version: "24"`) to match the local development environment (`node -v` → `v24.18.1`). If you upgrade Node locally, update this pin too.

---

## Known documented vulnerabilities (non-blocking)

Discovered by running `npm audit` across all three package graphs. None of these affect the production Node.js runtime serving real traffic — they are build-tool devDependency chains.

| Package | Via | Severity | Advisory | Safe Remediation |
|---------|-----|----------|----------|-----------------|
| `braces` | `tailwindcss@3` → `chokidar` | High | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Migrate to Tailwind CSS v4 (breaking config changes required — plan as a dedicated task) |
| `micromatch` | `tailwindcss@3` → `fast-glob` | High | GHSA-vfj7-8cjw-p6xm | Same as above |
| `postcss-selector-parser` | `tailwindcss@3` → `postcss-nested` | Moderate | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | Tailwind v4 migration |
| `deepmerge-ts` | `@prisma/config` | High | [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) | Upgrade `prisma` to ≥ 8.2.0 once stable and tested against the Supabase schema |

**Do not run `npm audit fix --force`** — it will downgrade tailwindcss to v4 which has incompatible configuration and will break the build.

---

## Locally runnable checks (pre-push)

You can run every CI check locally before pushing:

```bash
# 1. TypeScript type-check
npx tsc -b --noEmit                     # from /frontend

# 2. Lint
npm run lint --prefix frontend

# 3. Production build
npm run build --prefix frontend

# 4. Backend test suite (all 37 tests)
npm test

# 5. Advisory audit (informational only)
npm audit --audit-level=critical        # root
npm audit --audit-level=critical        # from /backend
```

---

## Checks that require the remote CI runner

The following steps **only run on GitHub Actions** and cannot be fully replicated locally without extra tooling:

| Check | Why it needs CI |
|-------|----------------|
| `actions/upload-artifact` | GitHub artifact storage |
| `GITHUB_STEP_SUMMARY` output | GitHub Actions-specific env var |
| `::error::` / `::warning::` annotations | GitHub Actions log commands |
| Secret scan over full `git log --all` | Requires a complete shallow-free clone (`fetch-depth: 0`) |
| Concurrency group cancellation | GitHub Actions runner queue feature |

---

## Render deployment (unchanged)

Render's deployment pipeline is **not modified** by this PR. Render continues to:
1. Detect pushes to `main`
2. Run `npm run build` (frontend Vite build)
3. Run `npm start` (backend Node server)

The quality gates run **before** code reaches `main` via a PR, acting as a pre-merge gate, not a deployment trigger.

---

## Adding future quality gates

To add a new check (e.g., integration tests, Prisma migration lint):

1. Add a new job to `.github/workflows/quality-gates.yml`
2. Use `runs-on: ubuntu-24.04` for consistency
3. Pin action versions with `@v4` (not `@latest`)
4. Never add real secrets to the workflow file — use `${{ secrets.MY_SECRET }}` references pointing to GitHub Actions secrets
