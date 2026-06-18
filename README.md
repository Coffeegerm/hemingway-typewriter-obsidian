# Hemingway Typewriter

> All you have to do is write one true sentence. Write the truest sentence that you know.  
> (Ernest Hemingway)

A focused writing plugin for [Obsidian](https://obsidian.md). It stops you from fighting yourself: you can only write forward, and the whole interface gets out of your way while you do it.

When active, Hemingway Typewriter disables the keys involved in editing (cursor movement, delete, undo, etc.) so you can only write forward from where your cursor is — you can't go back to revise. Pair that with a distraction-free **focus mode** and you get a true typewriter feel inside Obsidian.

## Features

### Write-only mode

- Blocks cursor movement (arrows, Home/End, Page Up/Down), Delete, and Undo, so you can't go back to edit.
- Keeps you writing forward from your current line instead of letting you move back through the note.
- Optionally still allows Backspace, for fixing the occasional typo or rewriting the current word.
- Shows an optional status bar indicator with configurable text.

### Focus mode

Turned on automatically with Hemingway mode (and individually configurable). Each of these can be toggled on or off:

- **Hide interface chrome** — collapses both sidebars and hides the ribbon, tab headers, and status bar for a clean screen. Your previous sidebar layout is restored when you turn the mode off.
- **Center text column** — narrows and centers the editor to a comfortable writing width.
- **Typewriter scrolling** — keeps the line you are writing vertically centered on screen.
- **Dim inactive paragraphs** — fades everything except the paragraph you are currently writing.

## Usage

The plugin adds a command, `Hemingway Typewriter: Toggle active`, which you can:

- Run from the command palette.
- Bind to a hotkey (Settings -> Hotkeys).
- Attach to a button or ribbon icon with a plugin like [Commander](https://github.com/phibr0/obsidian-commander).

## Settings

| Setting | Description |
| --- | --- |
| Hemingway mode enabled | Turns write-only mode on or off. |
| Show activation state in status bar | Shows an indicator while the mode is active. |
| Text to show in status bar | Customizes the indicator label. |
| Show notice when toggling status | Shows a brief notice when you toggle the mode. |
| Allow using Backspace key even if active | Permits deleting with Backspace while active. |
| Enable focus mode | Enters the distraction-free environment with Hemingway mode. |
| Hide interface chrome | Collapses sidebars and hides ribbon, tabs, and status bar. |
| Center text column | Narrows and centers the editor. |
| Typewriter scrolling | Keeps the active line vertically centered. |
| Dim inactive paragraphs | Fades everything but the current paragraph. |

## Install

You can use one of the following methods:

- **BRAT** — install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat), then add the repository `Coffeegerm/hemingway-mode-obsidian`. BRAT keeps it updated automatically.
- **Manual** — download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Coffeegerm/hemingway-mode-obsidian/releases) and copy them into `.obsidian/plugins/hemingway-typewriter/` in your vault, then enable the plugin under Settings -> Community plugins.
- **Community plugin registry** — listing is pending review.

> Tip: If you also use a separate typewriter-scrolling plugin, disable one of the two typewriter features to avoid double scrolling.

## Development

```bash
npm install      # install dependencies
npm run dev      # build and watch
npm run build    # type-check and produce a production main.js
```

## Credits

Hemingway Typewriter is a fork of [jobedom/obsidian-hemingway-mode](https://github.com/jobedom/obsidian-hemingway-mode) by Joaquín Bernal, extended with focus mode. Thanks to the original author and contributors.

## License

[MIT](LICENSE). Original work copyright Joaquín Bernal; fork modifications copyright David Yarzebinski.

Enjoy your writing!
