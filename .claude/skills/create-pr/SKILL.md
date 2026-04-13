---
name: create-pr
description: "Complete flow for creating a Pull Request in Lumen — branch from personal, develop, test, version bump (if needed), update CONTEXT.md, open PR. Use when starting ANY change (feature, fix, docs, config). All changes go through PRs — no local merges to personal."
---

# Creating a Pull Request in Lumen

All changes in Lumen go through a Pull Request. No local merges to `personal`. No direct pushes. No exceptions.

This skill is the complete flow from branch creation to opening the PR. After the PR is squash-merged on GitHub, use the `release` skill if a version was bumped.

## Checklist

You MUST create a task for each of these items and complete them in order:

1. Branch from `personal`
2. Develop & commit
3. Test (build / lint / tests)
4. Version bump (only if the branch touches `electron/**`, `electron-builder.yml`, or `package.json`)
5. Update `CONTEXT.md`
6. **Code review** (mandatory — use `superpowers:code-reviewer` agent)
7. Address review findings (if any)
8. Push branch + open PR (after user confirmation)

## 1. Branch from personal

**BLOCKING:** No editing any file until the branch exists. No exceptions — not even "small" changes.

```bash
git checkout personal
git pull origin personal
git checkout -b feature/<short-descriptive-name>
```

Branch naming:

- `feature/<name>` — new features, enhancements
- `fix/<name>` — bug fixes
- `docs/<name>` — documentation only
- `chore/<name>` — tooling, config, dependencies

## 2. Develop & commit

- Analyze existing code before modifying.
- Validate approach with the user before significant changes.
- Commit in small, descriptive units. The PR will be squash-merged (one commit on `personal`), but a clean branch history makes review easier.
- The pre-commit hook (husky + lint-staged) auto-runs prettier + eslint --fix on staged files. No need to run `npm run format` manually.

## 3. Test

Before marking ready:

```bash
npm run lint
npm run build
npm run test
```

For Electron changes: `npm run electron:dev` and have the user verify behavior manually. For web-only: `npm run dev`.

## 4. Version bump (conditional)

**Only if the branch touches any of these paths:**

- `electron/**`
- `electron-builder.yml`
- `package.json`

Otherwise, skip this step.

### Bump rules (SemVer)

| Commit types on the branch                        | Bump      | Example           |
| ------------------------------------------------- | --------- | ----------------- |
| Only `fix:` / `chore:` / `docs:` / `refactor:`    | **PATCH** | `0.3.0` → `0.3.1` |
| Any `feat:`                                       | **MINOR** | `0.3.0` → `0.4.0` |
| Breaking change / rebrand / architectural rewrite | **MAJOR** | `0.x.y` → `1.0.0` |

If mixed (e.g. 2 `fix:` + 1 `feat:`), the highest wins.

### How to bump

```bash
# Read the commits on your branch
git log personal..HEAD --oneline

# Edit package.json "version" field
# Commit as its own step:
git add package.json
git commit -m "chore: bump version to X.Y.Z"
```

The `verify-version` CI job will block the PR merge if the version already exists as a GitHub Release — this is intentional.

## 5. Update CONTEXT.md

Before opening the PR, always update `/CONTEXT.md`:

- `Ultima actualizacion` → today's date (+ new version if bumped)
- `Estado Actual` → updated status line
- `Version` → new version (if bumped)
- **New entry in the `Historial de Cambios Importantes` section** — summary of what this branch changes, grouped by commit type

Without this, the next session starts without context of what was just added.

## 6. Code review (MANDATORY)

Before opening the PR, dispatch the `superpowers:code-reviewer` agent. This catches issues early — it's cheaper to fix them in the branch than after a PR review cycle.

**Invocation pattern:**

```
Agent(
  description: "Code review feature/<name>",
  subagent_type: "superpowers:code-reviewer",
  prompt: "..."
)
```

The prompt must include:

- **Branch and base**: `feature/<name>` vs `personal`
- **Scope summary**: 5-10 bullets of what changes and why
- **How to get the diff**: `git diff personal..HEAD`, `git log personal..HEAD --oneline`
- **Focus areas**: correctness risks, security (especially for IPC / user-controlled input), UX corners (empty states, errors, accessibility), scope discipline (did anything sneak in?), dead code, codebase consistency
- **Output format**: Blockers / Important / Nits / Strengths — under 800 words, no preamble

**The reviewer must read actual files**, not just the diff — tell it to.

## 7. Address review findings

Triage the report:

- **Blockers** (correctness bugs, security holes, broken features) → fix in the same branch, commit
- **Important** (real bugs that aren't blockers, design concerns) → fix unless you have a concrete reason not to. Document the reasoning in the PR body.
- **Nits** (style, naming, minor polish) → fix if cheap, otherwise defer as follow-up
- **Strengths** → note in the PR body under "Code review fixes applied" so reviewer context is preserved

If the reviewer returns zero blockers on first pass, that is normal and expected for small changes. Do not invent issues to "show work".

## 8. Open the PR

**Get explicit user confirmation before running `gh pr create`.** Show the user:

- Proposed title
- Proposed body (Summary + Test plan)
- Branch status (commits, diff stat)

### Push and open

```bash
git push -u origin feature/<name>
gh pr create --base personal --head feature/<name> \
  --title "<title>" \
  --body "$(cat <<'EOF'
## Summary

<2-5 bullets describing what changes and why>

## Test plan

- [ ] <concrete verification step>
- [ ] <another>
EOF
)"
```

### Title rules

- Under 70 characters
- Conventional prefix: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `style:`
- Present-tense imperative: "add X", "fix Y", not "added" / "fixes"

### Body rules

- Summary: 2-5 bullets, one-line each, explaining **why** not just **what**
- Test plan: checklist items the reviewer can actually execute

## Checklist before ending the session

- [ ] PR URL captured and shared with user
- [ ] CONTEXT.md committed in the branch
- [ ] Version bumped if any electron/package.json files changed
- [ ] Tests + lint + build all green locally
- [ ] Code review completed; blockers fixed; remaining concerns documented in PR body
- [ ] Waiting on user review

## What NOT to do

- ❌ Never merge locally (`git merge feature/xxx`) to `personal`
- ❌ Never `git push origin personal` directly
- ❌ Never bump version on `personal` (always in the feature branch)
- ❌ Never tag manually — the release workflow tags + publishes automatically when the squash merge lands. Manual tagging is documented as a fallback in the `release` skill and should almost never run.
- ❌ Never skip `CONTEXT.md` update because "it's a small change"
- ❌ Never skip the code review step — even for "trivial" changes. Trivial-looking PRs are exactly where quiet bugs slip in.

## After the PR is open

- Reviewer (user or Claude) may request changes → push more commits to the same branch → PR updates automatically
- When approved → user does "Squash and merge" in the GitHub UI
- **Release happens automatically**: the push to `personal` triggers `.github/workflows/electron-release.yml`. `electron-builder --publish always` creates the `v<VERSION>` tag and publishes the GitHub Release with macOS/Linux/Windows assets (~3–5 min). No manual step required.
- Only reach for the `release` skill if the workflow failed and you've diagnosed the root cause — see that skill for fallback steps.
