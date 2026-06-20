# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Obsidian community plugin ("Hemingway Typewriter") that enforces a write-only typewriter mode: while active you can only write forward (editing/navigation keys are blocked), wrapped in an optional distraction-free focus environment. It is a fork of [jobedom/obsidian-hemingway-mode](https://github.com/jobedom/obsidian-hemingway-mode), extended with focus mode.

## Commands

```bash
npm install      # install dependencies
npm run dev      # esbuild watch -> main.js (inline sourcemap)
npm run build    # tsc -noEmit type-check, then production esbuild -> main.js
npm version <x>  # runs version-bump.mjs: syncs manifest.json + versions.json
```

There is no test suite. `main.js` is a committed build artifact (esbuild bundles `main.ts`), so when changing `main.ts` you generally need to rebuild before the plugin reflects changes in a vault.

## Architecture

Everything lives in `main.ts` (single source file). `styles.css` carries all the visual focus-mode behavior; `manifest.json`/`versions.json` are Obsidian release metadata.

The design splits cleanly into two layers, and understanding the split is the key to working here:

**1. Per-editor behavior via CodeMirror 6 extensions** (registered once in `onload` through `registerEditorExtension`). These read live editor state and never touch global settings for their on/off decision directly — they read CM `StateField`s:
- `hemingwayModeState` / `toggleHemingwayMode` — whether write-only mode is active in this editor.
- `focusModeState` / `toggleFocusMode` — whether focus (dimming) is active in this editor.
- The extensions are: a typewriter-scrolling `ViewPlugin` (centers the caret's visual row via `requestMeasure`), a `mousedown` handler (mouse-lock), a `Prec.highest` `keydown` handler (blocks arrows/Home/End/PageUp-Down/Delete/undo/Backspace), a class-toggling `ViewPlugin` (adds `.hemingway`), and a decoration `ViewPlugin` (dims non-active paragraphs with `cm-hemingway-dim`).

**2. Global/workspace-level effects driven by settings**, orchestrated from `updateStatus()`. This toggles `body` classes (`hemingway-focus`, `-chrome`, `-center`, `-typewriter`) that `styles.css` keys off of, collapses/restores sidebars, and shows/hides the status bar. `updateEditor()` is the bridge: it reaches into the active `MarkdownView`'s underlying `EditorView` (`(editor as any).cm`) and dispatches `toggleHemingwayMode`/`toggleFocusMode` effects to sync layer 1 with the settings.

### Things to know before editing

- **Settings are the single source of truth**; `updateStatus()` is the central reconciler. After changing any setting, call `this.plugin.updateStatus(quiet)` so both layers re-sync. Pass `quiet=true` to suppress the toggle Notice for non-enable/disable changes.
- **CM state is only synced for the *active* editor.** `updateEditor()` dispatches to the current `MarkdownView` only; the `init()` values on the StateFields seed newly-opened editors from `this.settings`.
- **Typewriter scrolling is independent of focus mode.** Its `body.hemingway-focus-typewriter` class is applied *after* the focus block in `updateStatus()` so it survives `exitFocusMode()`, and its CM ViewPlugin gates on `settings.focusTypewriter` directly. Comments in `main.ts` document the anti-jitter / requestMeasure reasoning — preserve that behavior.
- **Sidebar restore is stateful**: `enterFocusMode` records `prevLeft/RightCollapsed` once; `restoreSidebars` only re-expands panels that were open before and clears the saved state. Don't expand unconditionally.
- **Obsidian's settings-modal API (`app.setting`) is not in the public typings.** It's feature-detected via `getSettingApi()` rather than blindly cast — keep that defensive pattern for any new private-API use.
- **Mobile quirks** are handled in CSS (`body.is-mobile` disables the dim transition; chrome-hiding also targets `.mobile-toolbar`/`.mobile-navbar`). The plugin is *not* desktop-only (`isDesktopOnly: false`), so keep mobile in mind.
