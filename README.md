# Hemingway Typewriter

> All you have to do is write one true sentence. Write the truest sentence that you know.  
> (Ernest Hemingway)

A focused writing plugin for [Obsidian](https://obsidian.md). It stops you from fighting yourself: you can only write forward, and the whole interface gets out of your way while you do it.

When active, Hemingway Typewriter can disable the keys involved in editing (cursor movement, delete, undo, etc.) so you can only write forward from where your cursor is — you can't go back to revise. Pair that with a distraction-free **focus mode** and you get a true typewriter feel inside Obsidian. Prefer to keep the calm focus view but still edit freely? The write-only lock is a single switch you can turn off.

## Features

### Write-only mode

Editing locks live behind one **Lock editing** switch (on by default). While it's on:

- Blocks cursor movement (arrows, Home/End, Page Up/Down), Delete, and Undo *within the editor*, so you can't go back to edit. The rest of Obsidian — file explorer, search, command palette — stays fully navigable.
- Optionally locks the **mouse** too, so clicks can't reposition the caret.
- Switching notes drops the caret at the **end** of the note, so you keep writing forward instead of landing at the top with no way down.
- Optionally still allows **Backspace**, for fixing the occasional typo.

Turn **Lock editing** off and you keep the typewriter scrolling and focus view while editing and navigating freely — focus without the write-only constraint.

A status bar indicator can be shown (click it to toggle the mode).

### Typewriter scrolling

Keeps the line you are writing vertically centered on screen — including inside soft-wrapped paragraphs — so your eyes stay in one place as you write. Works on its own, with or without focus mode.

### Focus mode

A distraction-free environment, turned on automatically with Hemingway mode (and individually configurable). Each of these can be toggled on or off:

- **Hide interface chrome** — collapses both sidebars and hides the ribbon, tab headers, and status bar (plus the mobile toolbar and navbar) for a clean screen. Your previous sidebar layout is restored when you turn the mode off.
- **Center text column** — narrows and centers the editor to a comfortable writing width.
- **Dim inactive text** — fades everything except the sentence you're currently writing, like iA Writer's focus mode.

## Usage

Toggle Hemingway mode any of these ways:

- Run the command `Hemingway Typewriter: Toggle active` from the command palette.
- Bind that command to a hotkey (Settings -> Hotkeys).
- Click the **status bar** indicator (when shown).
- Enable **Show ribbon icon** in settings to add a feather button to the left sidebar (off by default).

## Settings

Settings are grouped into three sections:

| Setting | Description |
| --- | --- |
| Hemingway mode enabled | Master switch — turns the writing mode on or off. |
| **Editing** | |
| Lock editing (write-only) | Blocks editing and navigation so you can only write forward. Turn off to keep the typewriter and focus view while editing freely. |
| Allow Backspace while locked | Lets Backspace delete text even when editing is locked. |
| Lock mouse cursor | Stops mouse clicks from moving the cursor while editing is locked. |
| **Interface** | |
| Show activation state in status bar | Shows an indicator while the mode is active. |
| Show notice when toggling status | Shows a brief notice when you toggle the mode. |
| Show ribbon icon | Adds a left-sidebar button to toggle the mode (off by default). |
| **Focus mode** | |
| Typewriter scrolling | Keeps the active line vertically centered (works with or without focus mode). |
| Enable focus mode | Enters the distraction-free environment with Hemingway mode. |
| Hide interface chrome | Collapses sidebars and hides the ribbon, tabs, status bar, and mobile toolbar/navbar. |
| Center text column | Narrows and centers the editor. |
| Dim inactive text | Fades everything except the current sentence (iA Writer style). |

## Install

You can use one of the following methods:

- **BRAT** — install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat), then add the repository `Coffeegerm/hemingway-typewriter-obsidian`. BRAT keeps it updated automatically.
- **Manual** — download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Coffeegerm/hemingway-typewriter-obsidian/releases) and copy them into `.obsidian/plugins/hemingway-typewriter/` in your vault, then enable the plugin under Settings -> Community plugins.
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
