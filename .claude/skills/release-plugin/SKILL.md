---
name: release-plugin
description: Use when asked to cut a release, bump the version, or prepare a GitHub release of the Hemingway Typewriter plugin. Handles version sync across manifest.json and versions.json plus the release artifacts.
---

# Release the plugin

Obsidian plugins are released as a GitHub release containing `main.js`, `manifest.json`, and `styles.css`. The version must be kept in sync across `package.json`, `manifest.json`, and `versions.json`.

## Steps

1. Make sure the working tree is clean and on `main`, and that a production build is current:
   ```bash
   npm run build
   ```
2. Bump the version. `npm version` runs `version-bump.mjs`, which copies the new version into `manifest.json` and adds a `<version>: <minAppVersion>` entry to `versions.json`, then `git add`s both:
   ```bash
   npm version <patch|minor|major>   # or an explicit x.y.z
   ```
   - Do NOT hand-edit version numbers in the three files; let this script keep `manifest.json` and `versions.json` aligned.
   - If `minAppVersion` itself needs to change, edit it in `manifest.json` first, then run the bump so `versions.json` records the new floor.
3. Confirm the commit/tag `npm version` produced, then push including tags:
   ```bash
   git push && git push --tags
   ```
4. Create the GitHub release whose tag matches the new version (no leading `v` — Obsidian expects the bare number), attaching the three artifacts:
   ```bash
   gh release create <version> main.js manifest.json styles.css --title <version> --notes "<summary>"
   ```

## Notes

- The three release files are exactly `main.js`, `manifest.json`, `styles.css` — these are what BRAT and manual installs pull.
- Only push or create releases when the user explicitly asks. If on a branch other than `main`, confirm before tagging.
- Community-registry listing (per README) is a separate, pending review process — not part of cutting a release.
