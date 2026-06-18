import { App, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, StateEffect, EditorState, RangeSetBuilder } from "@codemirror/state";

interface HemingwayModePluginSettings {
  enabled: boolean;
  allowBackspace: boolean;
  lockMouse: boolean;
  showToggleNotice: boolean;
  showStatusBar: boolean;
  focusMode: boolean;
  focusHideChrome: boolean;
  focusCenterColumn: boolean;
  focusTypewriter: boolean;
  focusDimParagraph: boolean;
}

const DEFAULT_SETTINGS: HemingwayModePluginSettings = {
  enabled: false,
  allowBackspace: false,
  lockMouse: true,
  showToggleNotice: true,
  showStatusBar: true,
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
  prevLeftCollapsed: boolean | undefined;
  prevRightCollapsed: boolean | undefined;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new HemingwayModeSettingTab(this.app, this));

    this.statusBar = this.addStatusBarItem();
    this.statusBar.addClass("hemingway-mode-status");
    this.statusBar.hide();

    this.addCommand({
      id: "toggle-active",
      name: "Toggle active",
      callback: () => {
        this.settings.enabled = !this.settings.enabled;
        this.saveSettings();
        this.updateStatus();
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-this-alias -- inline CodeMirror plugin classes need a reference to the plugin instance
    const plugin = this;

    this.registerEditorExtension([
      hemingwayModeState.init(() => this.settings.enabled),
      focusModeState.init(() => this.settings.enabled && this.settings.focusMode),

      // With typewriter scrolling on, keep the line being written vertically
      // centered. Done in a transaction filter so we never dispatch while an
      // editor update is already in progress. We only re-center when the caret
      // moves to a different line: re-centering on every keystroke fights
      // CodeMirror's own cursor scrolling and makes the text jitter. The caret
      // is intentionally NOT forced anywhere; backward movement is blocked by
      // the keydown handler, so writing stays on the current line.
      EditorState.transactionFilter.of((tr) => {
        const hemingway = tr.startState.field(hemingwayModeState, false) ?? false;
        const focus = tr.startState.field(focusModeState, false) ?? false;
        if (!hemingway || !focus || !this.settings.focusTypewriter) {
          return tr;
        }
        if (!tr.docChanged && !tr.selection) {
          return tr;
        }
        const fromLine = tr.startState.doc.lineAt(tr.startState.selection.main.head).number;
        const toLine = tr.newDoc.lineAt(tr.newSelection.main.head).number;
        if (fromLine === toLine) {
          return tr;
        }
        return [tr, { effects: EditorView.scrollIntoView(tr.newSelection.main.head, { y: "center" }) }];
      }),

      // Stop the mouse from repositioning the caret while writing forward.
      // The first click can still focus an unfocused editor; once focused,
      // clicks no longer move the caret.
      EditorView.domEventHandlers({
        mousedown: (event, view) => {
          const active = view.state.field(hemingwayModeState, false) ?? false;
          if (active && plugin.settings.lockMouse && view.hasFocus) {
            event.preventDefault();
            return true;
          }
          return false;
        },
      }),

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

    this.registerDomEvent(document, "keydown", (evt: KeyboardEvent) => {
        const isEnabled = this.settings.enabled;

        if (isEnabled) {
            const forbiddenKeys = [
                "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
                "Home", "End", "PageUp", "PageDown",
                "Delete",
            ];

            if (forbiddenKeys.includes(evt.key) || (evt.key === 'z' && (evt.ctrlKey || evt.metaKey))) {
                evt.preventDefault();
                evt.stopPropagation();
            }

            if (evt.key === "Backspace" && !this.settings.allowBackspace) {
                evt.preventDefault();
                evt.stopPropagation();
            }
        }
    }, { capture: true });


    this.updateStatus();
  }

  onunload() {
    this.updateEditor(false);
    this.exitFocusMode();
    this.statusBar.remove();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  updateStatus(quiet = false) {
    if (this.settings.enabled) {
      if (this.settings.showStatusBar) {
        this.statusBar.setText("Hemingway");
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
    } else {
      this.statusBar.hide();
      this.updateEditor(false);
      this.exitFocusMode();
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
    document.body.toggleClass("hemingway-focus-typewriter", s.focusTypewriter);

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
      text: "\u2190",
      cls: "hemingway-back-button",
    });
    backButton.addEventListener("click", () => {
      const setting = (this.app as unknown as { setting?: { openTabById?: (id: string) => void } }).setting;
      setting?.openTabById?.("community-plugins");
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
      .setName("Allow using Backspace key even if active")
      .setDesc("Allows deleting text with Backspace. This is useful for lousy typists.")
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
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.lockMouse).onChange(async (value) => {
          this.plugin.settings.lockMouse = value;
          await this.plugin.saveSettings();
          this.plugin.updateStatus(true);
        })
      );

    new Setting(containerEl).setName("Focus mode").setHeading();

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
        .setName("Typewriter scrolling")
        .setDesc("Keeps the line you are writing vertically centered.")
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.focusTypewriter).onChange(async (value) => {
            this.plugin.settings.focusTypewriter = value;
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
