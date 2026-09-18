# Compose Diagram Examples Index

Annotated usage transcripts showing how the `compose-diagram` skill composes
tool calls to build and edit LeanIX diagrams. Each transcript walks a realistic
request end to end — the user's ask, the tool calls in order, the diffs they
return, and the reply.

---

## How to read these

Diagrams are built by **composing tool calls**, never by writing XML. The
transcripts use the fully-qualified tool names (`mcp__leanix__*`) exactly as the
skill does, and show the key rules in action:

- **Draft lifecycle** — `create_diagram_draft` → mutations → `commit_diagram_draft`
  is a transaction pair. Nothing persists until commit.
- **Sequential calls** — one call, wait for its diff, then the next. Never parallel.
- **Cell IDs come from diffs** — each mutation returns `addedCells[].id`; those
  IDs feed later calls (relate, expand, remove).
- **LeanIX data vs plain visuals** — fact sheets use the fact-sheet tools;
  non-LeanIX shapes use the plain cell/edge tools. Never substitute one for the other.

> Tool names are shortened to `create_diagram_draft` etc. in prose for
> readability, but every actual call is `mcp__leanix__create_diagram_draft`.

---

## Categories

| Category | Transcript | Demonstrates |
|----------|-----------|--------------|
| [build-from-scratch/](build-from-scratch/) | `new-diagram.md` | Open a new draft, place fact sheets, commit, return the URL |
| [relation-visualization/](relation-visualization/) | `dependencies-vs-drilldown.md` | Choosing `add_diagram_dependencies` vs `add_diagram_drill_down` |
| [editing-seeded-draft/](editing-seeded-draft/) | `edit-existing.md` | Seed a draft from an existing diagram, mutate it, commit as a version |
| [plain-visuals/](plain-visuals/) | `flowchart.md` | A standalone non-LeanIX diagram built from plain cells and edges |
| [failure-handling/](failure-handling/) | `not-found-and-empty.md` | Fact sheet not found, no matching relation, empty relation diff |

---

## Finding the right example

| I want to see how to… | Transcript |
|-----------------------|-----------|
| Build a fresh diagram from named entities | [build-from-scratch/new-diagram.md](build-from-scratch/new-diagram.md) |
| Show what an app depends on | [relation-visualization/dependencies-vs-drilldown.md](relation-visualization/dependencies-vs-drilldown.md) |
| Nest an entity's children inside it (drill-down) | [relation-visualization/dependencies-vs-drilldown.md](relation-visualization/dependencies-vs-drilldown.md) |
| Edit a diagram that already exists | [editing-seeded-draft/edit-existing.md](editing-seeded-draft/edit-existing.md) |
| Draw a process/flowchart with no LeanIX data | [plain-visuals/flowchart.md](plain-visuals/flowchart.md) |
| Handle a name that resolves to nothing | [failure-handling/not-found-and-empty.md](failure-handling/not-found-and-empty.md) |
| Handle a relation that returns no cells | [failure-handling/not-found-and-empty.md](failure-handling/not-found-and-empty.md) |
