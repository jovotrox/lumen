---
name: release
description: "Tag-based release flow for Lumen, to run AFTER a PR with a version bump has been squash-merged on GitHub. Pulls the new personal commit, creates the git tag, pushes it, and verifies the electron-release workflow succeeds."
---

# Releasing a Version

Lumen uses a tag-driven release flow. Pushing a `v<VERSION>` tag triggers the `electron-release.yml` GitHub Action, which builds for macOS/Linux/Windows and publishes a GitHub Release.

## When to use

**After** a PR with a version bump has been squash-merged on GitHub. This skill is the post-merge step — the version was already bumped in the PR (per the `create-pr` skill).

**Do NOT use this skill:**

- Before the PR is merged (the tag would point to a commit that isn't on `personal`)
- For PRs that didn't bump the version (e.g. docs-only, fix-only without touching `electron/**` or `package.json`)

## Checklist

You MUST complete these in order:

1. Pull the latest `personal`
2. Verify the version in `package.json`
3. Create and push the tag
4. Monitor the workflow

## 1. Pull the latest personal

The squash merge creates a NEW commit on `personal`. You need that commit local before tagging.

```bash
git checkout personal
git pull origin personal
```

## 2. Verify the version

Read `package.json` to get the version that was bumped in the PR:

```bash
VERSION=$(node -p "require('./package.json').version")
echo "v${VERSION}"
```

Sanity check:

- The version should be higher than the last git tag: `git describe --tags --abbrev=0`
- The tag `v${VERSION}` should NOT already exist: `git tag --list "v${VERSION}"`
- No existing GitHub Release with that version: `gh release view "v${VERSION}"` (exit 1 means it doesn't exist — good)

If any of these checks fail, stop and investigate before tagging.

## 3. Create and push the tag

```bash
git tag "v${VERSION}"
git push origin "v${VERSION}"
```

**Get user confirmation before the push.** Show them:

- The version being tagged
- The commit it will tag (`git log -1 --oneline`)
- A reminder that this will trigger a release build (~10min)

## 4. Monitor the workflow

Pushing the tag triggers `electron-release.yml`. Check status:

```bash
gh run list --workflow=electron-release.yml --limit 3
```

Wait for the run to complete. Common failure modes:

- **`verify-version` fails** → `v${VERSION}` already exists as a Release. Someone else tagged, or the bump logic failed. Do NOT retry without investigating.
- **Build step fails on a specific platform** → check the run log. Retry if transient (network); fix if code/config issue.
- **Publish fails** → check `GH_TOKEN` permissions.

On success, the release appears in [Releases](https://github.com/jovotrox/lumen/releases) as **published** (not draft, thanks to `releaseType: release` in `electron-builder.yml`).

## 5. Update the user

Once the release is live, tell the user:

- New release URL
- Download badge in README will auto-update (shields.io polls the GitHub Releases API)

## Why tag AFTER the squash merge, not before

GitHub's "Squash and merge" creates a brand-new commit on `personal` that is NOT the same commit as the HEAD of the feature branch. If you tag the feature branch HEAD before the merge:

1. The tag points to a commit only in the feature branch history
2. After squash merge, that commit is orphaned (the branch is usually deleted)
3. `git describe` on `personal` doesn't find the tag
4. The GitHub Release points to a dead commit

Always: merge first, pull `personal`, tag the squash commit.

## What NOT to do

- ❌ Never tag before the PR is merged
- ❌ Never create a tag on the feature branch
- ❌ Never force-push a tag (`git push --force origin v*`) — would silently move an existing release marker
- ❌ Never skip `gh release view` check — catching double-tag early is cheaper than a failed CI run
