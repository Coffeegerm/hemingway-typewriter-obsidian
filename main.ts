import { App, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, StateEffect, RangeSetBuilder, Prec } from "@codemirror/state";

interface HemingwayModePluginSettings {
  enabled: boolean;
  lockEditing: boolean;
  allowBackspace: boolean;
  lockMouse: boolean;
  showToggleNotice: boolean;
  showStatusBar: boolean;
  showRibbonIcon: boolean;
  focusMode: boolean;
  focusHideChrome: boolean;
  focusCenterColumn: boolean;
  focusTypewriter: boolean;
  focusDimParagraph: boolean;
}

const DEFAULT_SETTINGS: HemingwayModePluginSettings = {
  enabled: false,
  lockEditing: true,
  allowBackspace: false,
  lockMouse: true,
  showToggleNotice: true,
  showStatusBar: true,
  showRibbonIcon: false,
  focusMode: true,
  focusHideChrome: true,
  focusCenterColumn: true,
  focusTypewriter: true,
  focusDimParagraph: true,
};

// State field to track whether Hemingway mode is active in the editor
const hemingwayModeState = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleHemingwayMode)) {
        return effect.value;
      }
    }
    return value;
  },
});

const toggleHemingwayMode = StateEffect.define<boolean>();

// Mirrors whether focus mode is active inside a given editor
const focusModeState = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleFocusMode)) {
        return effect.value;
      }
    }
    return value;
  },
});

const toggleFocusMode = StateEffect.define<boolean>();

const dimLineDecoration = Decoration.line({ class: "cm-hemingway-dim" });

export default class HemingwayModePlugin extends Plugin {
  settings: HemingwayModePluginSettings;
  statusBar: HTMLElement;
  ribbonIcon?: HTMLElement;
  prevLeftCollapsed: boolean | undefined;
  prevRightCollapsed: boolean | undefined;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new HemingwayModeSettingTab(this.app, this));

    this.updateRibbonIcon();

    this.statusBar = this.addStatusBarItem();
    this.statusBar.addClass("hemingway-mode-status");
    this.statusBar.setText("Hemingway");
    this.statusBar.setAttribute("aria-label", "Toggle Hemingway mode");
    this.registerDomEvent(this.statusBar, "click", () => this.toggleActive());
    this.statusBar.hide();

    this.addCommand({
      id: "toggle-active",
      name: "Toggle active",
      callback: () => this.toggleActive(),
    });

    // While active, switching notes should drop the caret at the end so you can
    // keep writing forward — otherwise you land at the top with no way to move
    // down (editing keys are blocked).
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.moveCursorToDocEnd())
    );

    // eslint-disable-next-line @typescript-eslint/no-this-alias -- inline CodeMirror plugin classes need a reference to the plugin instance
    const plugin = this;

    this.registerEditorExtension([
      hemingwayModeState.init(() => this.settings.enabled),
      focusModeState.init(() => this.settings.enabled && this.settings.focusMode),

      // Typewriter scrolling: keep the caret's current VISUAL row vertically
      // centered while writing — including inside soft-wrapped paragraphs.
      // On every caret-affecting change we measure the caret's actual on-screen
      // position (coordsAtPos = the current visual row, even mid-paragraph) and
      // nudge scrollTop so the caret sits at the viewport center. This is
      // self-correcting: it re-centers after a manual scroll, and it no-ops when
      // the caret is already centered (so steady typing on one row stays put and
      // never jitters). Measuring/scrolling happens in requestMeasure so we never
      // touch the DOM during an in-progress update.
      ViewPlugin.fromClass(
        class {
          private scheduled = false;

          constructor(view: EditorView) {
            this.center(view);
          }

          private enabled(view: EditorView): boolean {
            const hemingway = view.state.field(hemingwayModeState, false) ?? false;
            return hemingway && plugin.settings.focusTypewriter;
          }

          update(update: ViewUpdate) {
            if (!this.enabled(update.view)) return;
            // Ignore pure scrolls (incl. our own scrollTop write) to avoid loops;
            // only react when the caret moved or the doc changed.
            if (!update.docChanged && !update.selectionSet) return;
            this.center(update.view);
          }

          private center(view: EditorView) {
            if (this.scheduled) return;
            this.scheduled = true;
            view.requestMeasure({
              read: () => {
                const head = view.state.selection.main.head;
                const coords = view.coordsAtPos(head);
                if (!coords) return null;
                const scroller = view.scrollDOM;
                const caretCenter =
                  (coords.top + coords.bottom) / 2 - scroller.getBoundingClientRect().top;
                return caretCenter - scroller.clientHeight / 2; // delta to centered
              },
              write: (delta) => {
                this.scheduled = false;
                if (delta === null || !this.enabled(view)) return;
                if (Math.abs(delta) > 1) {
                  view.scrollDOM.scrollTop += delta; // browser clamps to valid range
                }
              },
            });
          }
        }
      ),

      // Stop the mouse from repositioning the caret while writing forward.
      // The first click can still focus an unfocused editor; once focused,
      // clicks no longer move the caret.
      EditorView.domEventHandlers({
        mousedown: (event, view) => {
          const active = view.state.field(hemingwayModeState, false) ?? false;
          if (active && plugin.settings.lockEditing && plugin.settings.lockMouse && view.hasFocus) {
            event.preventDefault();
            return true;
          }
          return false;
        },
      }),

      // Block the editing keys that would let you move back through the note
      // (arrows, Home/End, Page Up/Down, Delete, undo — and Backspace unless
      // allowed). Scoped to the editor via the highest precedence so it beats
      // CodeMirror's own keymaps (e.g. undo) but leaves the rest of Obsidian's
      // UI — file explorer, search, command palette — fully navigable.
      Prec.highest(
        EditorView.domEventHandlers({
          keydown: (event, view) => {
            const active = view.state.field(hemingwayModeState, false) ?? false;
            if (!active || !plugin.settings.lockEditing) {
              return false;
            }
            const forbiddenKeys = [
              "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
              "Home", "End", "PageUp", "PageDown",
              "Delete",
            ];
            if (forbiddenKeys.includes(event.key) || (event.key === "z" && (event.ctrlKey || event.metaKey))) {
              event.preventDefault();
              return true;
            }
            if (event.key === "Backspace" && !plugin.settings.allowBackspace) {
              event.preventDefault();
              return true;
            }
            return false;
          },
        })
      ),

      ViewPlugin.fromClass(
        class {
          view: EditorView;

          constructor(view: EditorView) {
            this.view = view;
            this.updateClass();
          }

          update(update: ViewUpdate) {
            if (update.transactions.some((tr) => tr.effects.some((e) => e.is(toggleHemingwayMode)))) {
              this.updateClass();
            }
          }

          updateClass() {
            if (this.view.state.field(hemingwayModeState)) {
              this.view.dom.addClass("hemingway");
            } else {
              this.view.dom.removeClass("hemingway");
            }
          }
        }
      ),

      ViewPlugin.fromClass(
        class {
          decorations: DecorationSet;

          constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
          }

          update(update: ViewUpdate) {
            if (
              update.docChanged ||
              update.selectionSet ||
              update.viewportChanged ||
              update.transactions.some((tr) => tr.effects.some((e) => e.is(toggleFocusMode)))
            ) {
              this.decorations = this.buildDecorations(update.view);
            }
          }

          buildDecorations(view: EditorView): DecorationSet {
            const focus = view.state.field(focusModeState, false) ?? false;
            if (!focus || !plugin.settings.focusDimParagraph) {
              return Decoration.none;
            }

            const doc = view.state.doc;
            const head = view.state.selection.main.head;
            const currentLine = doc.lineAt(head);
            const isBlank = (lineNumber: number) => doc.line(lineNumber).text.trim().length === 0;

            let firstLine = currentLine.number;
            let lastLine = currentLine.number;
            if (!isBlank(currentLine.number)) {
              while (firstLine > 1 && !isBlank(firstLine - 1)) firstLine--;
              while (lastLine < doc.lines && !isBlank(lastLine + 1)) lastLine++;
            }

            const builder = new RangeSetBuilder<Decoration>();
            for (const { from, to } of view.visibleRanges) {
              let pos = from;
              while (pos <= to) {
                const line = doc.lineAt(pos);
                if (line.number < firstLine || line.number > lastLine) {
                  builder.add(line.from, line.from, dimLineDecoration);
                }
                pos = line.to + 1;
              }
            }
            return builder.finish();
          }
        },
        {
          decorations: (value) => value.decorations,
        }
      ),
    ]);

    this.updateStatus();
  }

  onunload() {
    this.updateEditor(false);
    this.exitFocusMode();
    document.body.removeClass("hemingway-lock-editing");
    this.statusBar.remove();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  toggleActive() {
    this.settings.enabled = !this.settings.enabled;
    this.saveSettings();
    this.updateStatus();
  }

  updateRibbonIcon() {
    if (this.settings.showRibbonIcon && !this.ribbonIcon) {
      this.ribbonIcon = this.addRibbonIcon("feather", "Toggle Hemingway mode", () => this.toggleActive());
      this.ribbonIcon.toggleClass("is-active", this.settings.enabled);
    } else if (!this.settings.showRibbonIcon && this.ribbonIcon) {
      this.ribbonIcon.remove();
      this.ribbonIcon = undefined;
    }
  }

  moveCursorToDocEnd() {
    if (!this.settings.enabled || !this.settings.lockEditing) return;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.editor) return;
    const editor = view.editor;
    const lastLine = editor.lastLine();
    const pos = { line: lastLine, ch: editor.getLine(lastLine).length };
    editor.setCursor(pos);
    editor.scrollIntoView({ from: pos, to: pos }, true);
  }

  updateStatus(quiet = false) {
    this.ribbonIcon?.toggleClass("is-active", this.settings.enabled);

    if (this.settings.enabled) {
      if (this.settings.showStatusBar) {
        this.statusBar.show();
      } else {
        this.statusBar.hide();
      }
      this.updateEditor(true);
      if (this.settings.focusMode) {
        this.enterFocusMode();
      } else {
        this.exitFocusMode();
      }
      // Typewriter padding is independent of Focus mode; applied after the
      // focus block so it survives the exitFocusMode() call above.
      document.body.toggleClass("hemingway-focus-typewriter", this.settings.focusTypewriter);
      // Gates the content's pointer-events lock — off lets the mouse navigate.
      document.body.toggleClass("hemingway-lock-editing", this.settings.lockEditing);
    } else {
      this.statusBar.hide();
      this.updateEditor(false);
      this.exitFocusMode();
      document.body.removeClass("hemingway-lock-editing");
    }

    if (this.settings.showToggleNotice && !quiet) {
      new Notice(`Hemingway mode ${this.settings.enabled ? "active" : "inactive"}`, 2000);
    }
  }

  updateEditor(isEnabled: boolean) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view && view.editor) {
      const editorView = (view.editor as any).cm as EditorView;
      editorView.dispatch({
        effects: [
          toggleHemingwayMode.of(isEnabled),
          toggleFocusMode.of(isEnabled && this.settings.focusMode),
        ],
      });
    }
  }

  enterFocusMode() {
    const s = this.settings;
    document.body.addClass("hemingway-focus");
    document.body.toggleClass("hemingway-focus-chrome", s.focusHideChrome);
    document.body.toggleClass("hemingway-focus-center", s.focusCenterColumn);

    if (s.focusHideChrome) {
      // Remember the sidebars' prior state once, so we can restore it exactly
      if (this.prevLeftCollapsed === undefined) {
        this.prevLeftCollapsed = this.app.workspace.leftSplit.collapsed;
      }
      if (this.prevRightCollapsed === undefined) {
        this.prevRightCollapsed = this.app.workspace.rightSplit.collapsed;
      }
      this.app.workspace.leftSplit.collapse();
      this.app.workspace.rightSplit.collapse();
    } else {
      this.restoreSidebars();
    }
  }

  exitFocusMode() {
    document.body.removeClass("hemingway-focus");
    document.body.removeClass("hemingway-focus-chrome");
    document.body.removeClass("hemingway-focus-center");
    document.body.removeClass("hemingway-focus-typewriter");

    this.restoreSidebars();
  }

  restoreSidebars() {
    // Only re-expand panels that we collapsed (were open before focus mode)
    if (this.prevLeftCollapsed === false) {
      this.app.workspace.leftSplit.expand();
    }
    if (this.prevRightCollapsed === false) {
      this.app.workspace.rightSplit.expand();
    }
    this.prevLeftCollapsed = undefined;
    this.prevRightCollapsed = undefined;
  }
}

// Obsidian's settings-modal API isn't in the public typings. Feature-detecting
// it (rather than blindly casting) keeps the "back" button working where it
// exists and silently no-ops where it doesn't — the same defensive pattern used
// by established plugins such as Notebook Navigator.
interface SettingApi {
  open(): void;
  openTabById(id: string): void;
}

function getSettingApi(app: App): SettingApi | null {
  const setting = (app as { setting?: Partial<SettingApi> }).setting;
  if (!setting || typeof setting.open !== "function" || typeof setting.openTabById !== "function") {
    return null;
  }
  return setting as SettingApi;
}

class HemingwayModeSettingTab extends PluginSettingTab {
  plugin: HemingwayModePlugin;

  constructor(app: App, plugin: HemingwayModePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const backButton = containerEl.createEl("button", {
      text: "←",
      cls: "hemingway-back-button",
      attr: { "aria-label": "Back to community plugins" },
    });
    backButton.addEventListener("click", () => {
      const setting = getSettingApi(this.app);
      if (!setting) {
        return;
      }
      try {
        setting.open();
        setting.openTabById("community-plugins");
      } catch (e) {
        // The settings API shape changed; fail quietly rather than crash.
      }
    });

    new Setting(containerEl)
      .setName("Hemingway mode enabled")
      .setDesc("Prevents any editing, so you can only write ahead.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
          this.plugin.settings.enabled = value;
          await this.plugin.saveSettings();
          this.plugin.updateStatus();
        })
      );

    const lockEditing = this.plugin.settings.lockEditing;

    new Setting(containerEl).setName("Editing").setHeading();

    new Setting(containerEl)
      .setName("Lock editing (write-only)")
      .setDesc(
        "Blocks editing and navigation so you can only write forward. Turn off to keep the typewriter and focus view while still editing and navigating freely."
      )
      .addToggle((toggle) =>
        toggle.setValue(lockEditing).onChange(async (value) => {
          this.plugin.settings.lockEditing = value;
          await this.plugin.saveSettings();
          this.plugin.updateStatus(true);
          this.display();
        })
      );

    new Setting(containerEl)
      .setName("Allow using Backspace key even if active")
      .setDesc("Allows deleting text with Backspace. This is useful for lousy typists.")
      .setDisabled(!lockEditing)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.allowBackspace).onChange(async (value) => {
          this.plugin.settings.allowBackspace = value;
          await this.plugin.saveSettings();
          this.plugin.updateStatus(true);
        })
      );

    new Setting(containerEl)
      .setName("Lock mouse cursor")
      .setDesc("Prevents the mouse from moving the cursor while active, so you can only write forward.")
      .setDisabled(!lockEditing)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.lockMouse).onChange(async (value) => {
          this.plugin.settings.lockMouse = value;
          await this.plugin.saveSettings();
          this.plugin.updateStatus(true);
        })
      );

    new Setting(containerEl).setName("Interface").setHeading();

    new Setting(containerEl)
      .setName("Show activation state in status bar")
      .setDesc("Shows in the status bar when the write-only mode is active.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
          this.plugin.settings.showStatusBar = value;
          await this.plugin.saveSettings();
          this.plugin.updateStatus(true);
        })
      );

    new Setting(containerEl)
      .setName("Show notice when toggling status")
      .setDesc("Helps noticing changes between enabled and disabled.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showToggleNotice).onChange(async (value) => {
          this.plugin.settings.showToggleNotice = value;
          await this.plugin.saveSettings();
          this.plugin.updateStatus(true);
        })
      );

    new Setting(containerEl)
      .setName("Show ribbon icon")
      .setDesc("Adds a button in the left sidebar to toggle Hemingway mode.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showRibbonIcon).onChange(async (value) => {
          this.plugin.settings.showRibbonIcon = value;
          await this.plugin.saveSettings();
          this.plugin.updateRibbonIcon();
        })
      );

    new Setting(containerEl).setName("Focus mode").setHeading();

    new Setting(containerEl)
      .setName("Typewriter scrolling")
      .setDesc("Keeps the line you are writing vertically centered on screen.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.focusTypewriter).onChange(async (value) => {
          this.plugin.settings.focusTypewriter = value;
          await this.plugin.saveSettings();
          this.plugin.updateStatus(true);
        })
      );

    new Setting(containerEl)
      .setName("Enable focus mode")
      .setDesc("When Hemingway mode is active, enter a distraction-free writing environment.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.focusMode).onChange(async (value) => {
          this.plugin.settings.focusMode = value;
          await this.plugin.saveSettings();
          this.plugin.updateStatus(true);
          this.display();
        })
      );

    if (this.plugin.settings.focusMode) {
      new Setting(containerEl)
        .setName("Hide interface chrome")
        .setDesc("Collapses the sidebars and hides the ribbon, tabs, and status bar.")
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.focusHideChrome).onChange(async (value) => {
            this.plugin.settings.focusHideChrome = value;
            await this.plugin.saveSettings();
            this.plugin.updateStatus(true);
          })
        );

      new Setting(containerEl)
        .setName("Center text column")
        .setDesc("Narrows and centers the editor for a comfortable writing width.")
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.focusCenterColumn).onChange(async (value) => {
            this.plugin.settings.focusCenterColumn = value;
            await this.plugin.saveSettings();
            this.plugin.updateStatus(true);
          })
        );

      new Setting(containerEl)
        .setName("Dim inactive paragraphs")
        .setDesc("Fades everything except the paragraph you are currently writing.")
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.focusDimParagraph).onChange(async (value) => {
            this.plugin.settings.focusDimParagraph = value;
            await this.plugin.saveSettings();
            this.plugin.updateStatus(true);
          })
        );
    }
  }
}
