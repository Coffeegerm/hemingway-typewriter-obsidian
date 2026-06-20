---
name: add-setting
description: Use when adding a new user-facing setting/toggle to the Hemingway Typewriter plugin, or wiring a new behavior to be configurable. Walks the full path through main.ts and the two-layer architecture.
---

# Add a setting

Settings are the single source of truth; `updateStatus()` is the central reconciler that pushes them into both the global (body-class/workspace) layer and the per-editor CodeMirror layer. A new setting must be threaded through every place below or it will silently not take effect. All code is in `main.ts`.

## Steps

1. **Interface + defaults.** Add the field to `HemingwayModePluginSettings` and a default to `DEFAULT_SETTINGS`. Match the existing style (booleans for toggles).
2. **Settings UI.** Add a `new Setting(containerEl)` block in `HemingwayModeSettingTab.display()`. In its `onChange`: set `this.plugin.settings.<field> = value`, `await this.plugin.saveSettings()`, then `this.plugin.updateStatus(true)` (pass `true` to suppress the toggle Notice for non-enable changes). If the setting shows/hides other settings, also call `this.display()` to re-render (see how `focusMode` does it).
3. **Apply the behavior** — pick the correct layer:
   - **Global / workspace effect** (body class, sidebars, status bar): wire it inside `updateStatus()` (or `enterFocusMode`/`exitFocusMode`). Toggle a `body` class and add the matching rule in `styles.css`, following `hemingway-focus-*`.
   - **Per-editor editor behavior** (key handling, decorations, scrolling, mouse): it belongs in a CodeMirror extension in the `registerEditorExtension([...])` array. Those extensions gate on the `hemingwayModeState` / `focusModeState` StateFields and read `plugin.settings.<field>` for fine-grained on/off. If the behavior needs to flip live on toggle, also dispatch/handle it in `updateEditor()`, which sends `toggleHemingwayMode` / `toggleFocusMode` effects to the active editor.
4. **Seed new editors.** If the per-editor behavior depends on a StateField, make sure the field's `.init(...)` in `registerEditorExtension` derives from `this.settings` so freshly-opened editors start correct.
5. **Document it.** Add a row to the settings table in `README.md`.
6. **Build.** Run `npm run build` (see the build-plugin skill) and commit `main.js` with the `main.ts` change.

## Gotchas

- `updateEditor()` only syncs the *active* `MarkdownView`; non-active editors rely on the StateField `.init()` seed.
- Typewriter scrolling is intentionally independent of focus mode — its body class is applied after the focus block in `updateStatus()` and its ViewPlugin gates on `settings.focusTypewriter` directly. Don't fold a new independent feature into the focus-mode block unless it should turn off with focus mode.
- For any new use of Obsidian private APIs, feature-detect rather than blind-cast, following `getSettingApi()`.
