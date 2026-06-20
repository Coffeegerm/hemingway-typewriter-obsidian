---
name: skill-creator
description: Use when the user wants to create, scaffold, or edit a Claude Code skill in this repo. Generates a SKILL.md with correct frontmatter and structure under .claude/skills/.
---

# Skill creator

Create or refine Claude Code skills for this repository. A skill is a directory under `.claude/skills/<name>/` containing a `SKILL.md` file. When invoked, Claude loads the SKILL.md body and follows it as instructions.

## Anatomy of a skill

```markdown
---
name: <kebab-case-name>            # must match the directory name
description: <when to use this>     # the ONLY thing Claude sees when deciding to invoke; make it a trigger, not a summary
---

# <Title>

<Concise, imperative instructions. Tell Claude exactly what to do, in order.>
```

## Rules

- **`name`** is kebab-case and identical to the containing directory name.
- **`description`** is the single most important field — it is matched against the user's request to decide whether to load the skill. Write it as a trigger ("Use when the user wants to…"), name the concrete verbs/nouns that should fire it, and keep it to one or two sentences. Do not just restate the title.
- **Body** is for Claude, not end users. Be imperative and specific: list the exact files, commands, and order of operations. Prefer numbered steps for procedures.
- Reference real paths and commands from this repo — verify they exist before writing them. Don't invent build steps.
- Keep skills single-purpose. If a skill is doing two unrelated jobs, split it.
- Optional supporting files (templates, scripts) can live alongside SKILL.md in the same directory; reference them by relative path.

## Procedure

1. Clarify the skill's single purpose and its trigger conditions with the user if unclear.
2. Pick a kebab-case `name`; create `.claude/skills/<name>/` (the directory already-exists check is fine — just `mkdir -p`).
3. Write `SKILL.md` with the frontmatter and an imperative body. Ground every command/path in this codebase.
4. Confirm the file back to the user and note that the skill is invocable as `/<name>` once recognized.
