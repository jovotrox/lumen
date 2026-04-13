---
name: release
description: "Manual fallback for Lumen's release flow. The normal release path is fully automated: electron-release.yml triggers on push to personal, electron-builder --publish always with releaseType: release creates the tag AND the GitHub Release in one step. Only run this skill if the workflow failed or was skipped (rare)."
---

# Releasing a Version — Manual Fallback

## You almost never need this

Lumen's release flow is **fully automated**. When a PR with a version bump is squash-merged to `personal`:

1. The push to `personal` triggers `.github/workflows/electron-release.yml`
2. `verify-version` job confirms `v<VERSION>` doesn't already exist as a Release
3. Matrix build (macOS/Linux/Windows) runs `npx electron-builder --publish always`
4. electron-builder — configured with `publish.provider: github` + `releaseType: release` in `electron-builder.yml` — **creates the `v<VERSION>` tag on the squash commit AND publishes the GitHub Release with all assets in one step**
5. README download badge (shields.io) updates automatically once the Release is live

**No manual tagging. No Claude involvement. No user prompt after merge.**

Expected timeline from squash merge to Release visible: ~3–5 min (mostly the Windows build step).

## When to actually use this skill

**Rare.** Only if:

- The automated workflow **failed** (verify-version error, a platform build crashed, publish step lost credentials)
- The workflow **was skipped** (rare — would require the paths filter not to match, which means no Electron-relevant files changed and there shouldn't be a release anyway)
- You need to **re-release an existing version** (e.g. re-tag after a forced main reset — very unusual)

In all these cases the root cause matters. Don't reach for this skill reflexively: investigate the failure first.

## How to verify whether a release already exists

Before tagging manually, confirm the automation actually didn't complete:

```bash
# 1. What version does package.json say?
VERSION=$(node -p "require('./package.json').version")
echo "package.json: v${VERSION}"

# 2. Is there a GitHub Release for it?
gh release view "v${VERSION}" --json tagName,targetCommitish,publishedAt

# 3. Is the tag in the local repo?
git fetch --tags
git tag --list "v${VERSION}"

# 4. What does the release workflow say?
gh run list --workflow=electron-release.yml --limit 5
```

If the release exists → done, no action needed.
If the workflow failed → check `gh run view <run-id> --log-failed` and fix the root cause before re-running.

## Fallback steps (only if truly needed)

1. Pull latest `personal`:
   ```bash
   git checkout personal
   git pull origin personal
   ```
2. Read the version:
   ```bash
   VERSION=$(node -p "require('./package.json').version")
   ```
3. Sanity checks:
   - `git tag --list "v${VERSION}"` → should be empty locally
   - `gh release view "v${VERSION}"` → should error "not found"
   - If either exists, stop and investigate
4. **Ask the user for explicit confirmation** before tagging — manual tagging bypasses the CI verification step.
5. Tag the squash commit (which is the current HEAD of `personal` after step 1) and push:
   ```bash
   git tag "v${VERSION}"
   git push origin "v${VERSION}"
   ```
6. The tag push triggers `electron-release.yml` again (its `on: tags: "v*"` trigger). Monitor:
   ```bash
   gh run list --workflow=electron-release.yml --limit 3
   ```

## What NOT to do

- ❌ Never tag before the PR is merged to `personal` — the squash commit doesn't exist yet.
- ❌ Never tag on the feature branch — the squash creates a new commit on `personal` that won't equal the feature-branch HEAD.
- ❌ Never force-push a tag (`git push --force origin v*`) — this silently moves a release marker and breaks auto-updater for users on the old version.
- ❌ Never run this skill as a "just in case" after a normal merge. If the workflow ran, it already did this for you. Check first.
- ❌ Never bump the version here. Version bumps happen in the feature branch (via `create-pr` skill), never on `personal`.
