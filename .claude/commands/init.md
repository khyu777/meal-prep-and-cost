# /init — Session Kickoff

Run this at the start of every Claude Code session on an existing project.

## Steps

1. Read `CLAUDE.md` in full
2. Read `TODO.md` if it exists
3. Read `docs/architecture.md` if it exists
4. Print a structured session brief:

---
**Project:** [name from CLAUDE.md or directory name]
**Status:** [one sentence — what phase is the project in]
**In progress:** [active TODO items, or "none found" if TODO.md doesn't exist]
**Next up:** [first uncompleted item, or "not defined yet"]
**Open risks:** [any high/med items from TODO.md risks table, or "none logged"]
---

5. Ask: "What are we working on today?"

## Rules

- Do not write or modify any files during /init
- Do not begin any build work until the human responds to "What are we working on today?"
- If CLAUDE.md doesn't exist, stop and say: "No CLAUDE.md found. Run /scaffold first."
