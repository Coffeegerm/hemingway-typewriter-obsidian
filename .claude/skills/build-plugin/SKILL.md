---
name: build-plugin
description: Use when asked to build, compile, type-check, or rebuild the Hemingway Typewriter plugin, or to refresh main.js after editing main.ts.
---

# Build the plugin

`main.js` is a committed esbuild bundle of `main.ts`. After any change to `main.ts`, it must be rebuilt or the plugin in a vault will not reflect the change.

## Steps

1. Ensure dependencies are installed (only needed once / after `package.json` changes):
   ```bash
   npm install
   ```
2. For a production build (type-checks with `tsc -noEmit` first, then bundles, no sourcemap):
   ```bash
   npm run build
   ```
   Use this before committing or releasing. If `tsc` reports type errors, fix them in `main.ts` before re-running — the bundle is only produced after the type-check passes.
3. For active development with rebuild-on-save (inline sourcemap, no type-check):
   ```bash
   npm run dev
   ```
   This runs esbuild in watch mode and stays in the foreground; run it in the background if you need the shell.

## Notes

- The bundle entry is `main.ts` → `main.js` (see `esbuild.config.mjs`). `obsidian`, `electron`, and all `@codemirror/*` / `@lezer/*` packages are externals — do not try to bundle them.
- There is no test suite; verification is type-checking plus loading the plugin in an Obsidian vault.
- After `npm run build`, the changed `main.js` should be committed alongside the `main.ts` change.
