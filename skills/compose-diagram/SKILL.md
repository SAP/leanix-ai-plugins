---
name: compose-diagram
description: >-
  Use when the user wants to create, edit, or visualize a diagram or canvas. Covers 
  building a diagram/canvas from scratch, changing an existing one (add/remove/connect/
  restyle/move elements), and visualizing an entity's relations, dependencies, or 
  hierarchy as a diagram ("visualize this", "show SAP's dependencies", "diagram our 
  finance apps", "drill down into X", "put this on a canvas", "lay this out visually"). 
  Prefer this whenever the user wants to SEE the result as a diagram/canvas rather than 
  read it. NOT for answering as text/lists/counts or general Q&A.
license: Apache-2.0
compatibility: Requires LeanIX MCP server for API access (mcp__leanix__* tools)
metadata:
  author: SAP LeanIX
  version: "1.0"
allowed-tools:
  - mcp__leanix__create_diagram_draft
  - mcp__leanix__commit_diagram_draft
  - mcp__leanix__get_diagram_by_id
  - mcp__leanix__add_diagram_fact_sheet_cell
  - mcp__leanix__add_diagram_dependencies
  - mcp__leanix__add_diagram_drill_down
  - mcp__leanix__add_diagram_cell
  - mcp__leanix__add_diagram_edge
  - mcp__leanix__update_diagram_cell
  - mcp__leanix__remove_diagram_cells
  - mcp__leanix__search_fact_sheet_by_name
  - mcp__leanix__text_to_fact_sheets
  - mcp__leanix__get_workspace_context
---

# Compose Diagram

You build and edit LeanIX diagrams by composing tool calls — never by writing XML yourself.

**"Canvas" means "diagram."** Users may call it a canvas ("put this on a canvas", "add to my canvas"); it is the same thing — the LeanIX diagram you build with these tools. Treat the two terms as interchangeable throughout this skill.

## CRITICAL: API Access

**All LeanIX API calls use MCP tools.** No shell commands, no token exchange, no curl.

- **Authentication** is handled internally by the MCP server
- **No bearer tokens** need to be managed in the skill workflow
- **No `.mcp.json` parsing** is required — MCP handles credentials automatically

Before any LeanIX tool call: if only `mcp__leanix__authenticate` and `mcp__leanix__complete_authentication` are available, tell the user to run `/mcp` and authenticate the `leanix` server (browser opens automatically). Do NOT call `authenticate` yourself or suggest `claude mcp add` — the former returns a URL without triggering the browser flow (copy-paste UX), the latter would shadow the plugin's bundled server. If `/mcp` doesn't surface tools after auth, treat it as a plugin bug.

## Golden rules

These govern every request. The rest of this skill elaborates on them.

1. **`mcp__leanix__create_diagram_draft` + `mcp__leanix__commit_diagram_draft` are a transaction pair (BEGIN/END).** Every draft you open MUST be committed on the same `draft_id`, with **at least one mutation in between**. NEVER open a draft just to read a diagram (use `mcp__leanix__get_diagram_by_id`); NEVER open→commit with no change (a no-op that, for a new diagram, saves an empty one). This flow exists for editing only. If you open a draft, you own committing it — do not abandon it.
2. **Call tools strictly sequentially — NEVER in parallel.** Issue one call, wait for its diff, then the next. Each mutation depends on the prior one's `draft_id` and cell IDs, so a parallel batch is not supported.
3. **NEVER produce, copy, or hand-edit XML.** The server owns the XML; you change it only through tools, passing intent and parameters. `mcp__leanix__create_diagram_draft` may return the draft's XML once as a read-only reference — read it, never write it back.
4. **HTML in a cell's `value` MUST be raw, NEVER XML-escaped.** When a cell uses `html=1`, pass emphasis markup literally — `<b>SAP</b>`, `<br>`, `<font color="#6c8ebf">…</font>` — NEVER escaped (`&lt;b&gt;SAP&lt;/b&gt;`). Escaped tags render as visible literal text (`<b>SAP</b>` shown on the diagram) instead of formatting, which silently breaks the diagram's appearance. This is non-negotiable for every cell that carries styled text.
5. **Diagrams must always look good — clean, readable layout is a hard requirement, not a nice-to-have.** Shapes MUST NOT overlap unless overlap is explicitly intended: before placing or moving any cell, check that its `x`, `y`, `width`, and `height` are compatible with what is already on the diagram, and leave clear spacing between elements. Give text containers (summaries, legends, titles, annotations) enough height that their text never overlaps — when unsure, err on the side of a taller container rather than a cramped one. Route relations so edges do not cross fact sheets or pile up on each other (see Placing dependencies).
6. **Prefer acting over asking.** Default to producing a reasonable result: search, use what you find, apply sensible defaults, and let the user refine after seeing it — don't describe a plan and wait for confirmation on routine requests. But when a request is genuinely ambiguous (unclear what to diagram, which entities, or what the goal is) and a best-effort guess would likely be wrong, ask a brief clarifying question first.
7. **Always search then add** — resolve a fact sheet by name/attribute, never ask the user for a `fact_sheet_id`.
8. **Always give the user the diagram's URL after committing.** Call `mcp__leanix__get_diagram_by_id` for it and include it in your reply. The URL is stable (the `diagram_id` never changes), so fetch it **once** per diagram and reuse it across later edits.
9. **LeanIX data uses the fact-sheet tools; plain visuals use the cell/edge tools — never substitute one for the other.** A LeanIX entity → `mcp__leanix__add_diagram_fact_sheet_cell`, NEVER `mcp__leanix__add_diagram_cell`. A real relation between fact sheets → `mcp__leanix__add_diagram_dependencies` (or `mcp__leanix__add_diagram_drill_down` for hierarchical), NEVER `mcp__leanix__add_diagram_edge` — this holds even when both fact sheets are already on the diagram: connect them with `mcp__leanix__add_diagram_dependencies`, do NOT hand-place cells and wire them with a plain edge. A plain edge between two fact sheets is acceptable ONLY when the line represents some other, non-LeanIX semantic link. See Tool choice for why and the full mapping.

## Tools & how they connect

The workflow is a lifecycle: **open a draft → mutate it (many calls) → commit**. Nothing persists until commit. Every mutation takes the `draft_id` and returns only a **diff** — you never hold the whole diagram.

**Lifecycle**

- `mcp__leanix__create_diagram_draft(diagram_id?)` — opens a draft and returns its `draft_id` (thread this through every later call) plus the draft's initial XML. Omit `diagram_id` for a new diagram; pass one to seed the draft with an existing diagram for editing.
- `mcp__leanix__commit_diagram_draft(draft_id, name, description?)` — persists the draft. Unseeded draft → creates a new diagram (`name`/`description` = its title/description). Seeded draft → updates that diagram (`name` has no effect but is still required — pass the existing name; `description` becomes the **version message**: state the *intent* / WHY of the change, like a commit message, short (~250 chars), not the WHAT/HOW). Returns the `diagram_id`.
- `mcp__leanix__get_diagram_by_id(diagram_id)` — fetches a diagram's metadata (name, type, **URL**). Use for the shareable URL and to inspect a diagram — NOT to read its contents mid-edit.

**Placing LeanIX entities (the primary path)**

- `mcp__leanix__search_fact_sheet_by_name(name)` — resolves a known name → `fact_sheet_id`.
- `mcp__leanix__text_to_fact_sheets(...)` — finds fact sheets by attribute (lifecycle, owner, tags, …) → `fact_sheet_id`s.
- `mcp__leanix__add_diagram_fact_sheet_cell(draft_id, fact_sheet_id, x, y)` — places a resolved fact sheet as a properly-styled cell. Its diff gives you the cell's `id`, which you reuse to relate or remove it later.
- `mcp__leanix__get_workspace_context(include_meta_model=True, fact_sheet_types=[<type>])` — discovers a type's exact directional relation names (e.g. `relApplicationToITComponent`); needed before adding relations.
- `mcp__leanix__add_diagram_dependencies(draft_id, cell_ids[], relation_name, x, y)` — adds an on-diagram cell's related fact sheets as connected cells (real relation edges). Needs a starting `x`/`y` (see Placing dependencies).
- `mcp__leanix__add_diagram_drill_down(draft_id, cell_ids[], relation_name)` — nests an on-diagram cell's related fact sheets inside it. No `x`/`y` (children nest in the source); toggles.

**Plain visuals (non-LeanIX only)**

- `mcp__leanix__add_diagram_cell(draft_id, x, y, value?, style?, ...)` — a plain vertex (title, label, annotation, container, custom shape).
- `mcp__leanix__add_diagram_edge(draft_id, source_cell_id, target_cell_id, ...)` — a plain connector between two existing cells.
- `mcp__leanix__update_diagram_cell(draft_id, cell_id, ...)` — changes a **non-fact-sheet** cell's label, style, or geometry (only the fields you pass).
- `mcp__leanix__remove_diagram_cells(draft_id, cell_ids[])` — deletes cells by ID. Cascade depends on cell type: removing a **fact sheet cell** also removes its connected relation edges; removing a **drill-down container** also removes its nested children (draw.io default). Removing a **plain shape** leaves its connected edges in place — remove those explicitly. Unknown IDs are ignored.

## Reading diffs & tracking cell IDs

Underneath, a diagram is draw.io (mxGraph) XML — cells (vertices/edges), styles, parent/child nesting. Returning full XML each call would blow the context, so every mutation returns a **`DiagramDiffResponse`** instead:

| Field | Contents |
|---|---|
| `addedCells` | Cells created — each has an `id`; this is how you learn the IDs of what you just placed. |
| `removedCells` | Cells deleted. |
| `cellModifications` | Cells changed, each as `{ cellBefore, cellAfter }`. |

Cells are open-ended mxGraph shapes; only `id` is guaranteed. **Read `addedCells[].id`** to get IDs for follow-up calls (connecting, expanding, removing). Cell IDs come from two places: the **seed XML** (read-only reference for a seeded draft's existing cells) and the **diffs** of your own calls (all IDs for an unseeded draft). NEVER re-read the diagram's XML mid-edit to find an ID — if you lack a cell's ID, re-add the cell (or its relations) and take the ID from that diff.

### Worked example — chaining calls via diffs

Goal: a diagram with SAP and Oracle DB placed, then SAP expanded to its IT-component dependencies.

1. `mcp__leanix__create_diagram_draft()` → `draft_id="dr-123"` (no `diagram_id` → new diagram). Thread `"dr-123"` through every call below.
2. `mcp__leanix__search_fact_sheet_by_name("SAP")` → its `fact_sheet_id`. Same for "Oracle DB".
3. `mcp__leanix__add_diagram_fact_sheet_cell(draft_id="dr-123", fact_sheet_id=<sap>, x=20, y=20)` → `addedCells: [{ id: "2" }]` → `"2"` = SAP.
4. `mcp__leanix__add_diagram_fact_sheet_cell(draft_id="dr-123", fact_sheet_id=<oracle>, x=200, y=20)` → `addedCells: [{ id: "3" }]` → `"3"` = Oracle.
5. `mcp__leanix__get_workspace_context(include_meta_model=True, fact_sheet_types=["Application"])` → find the relation name (e.g. `relApplicationToITComponent`).
6. `mcp__leanix__add_diagram_dependencies(draft_id="dr-123", cell_ids=["2"], relation_name="rel...", x=400, y=140)` → diff returns the new cells + relation edge. (Dependencies anchored **below and clear of** SAP and Oracle (both at `y=20`), so edges drop down cleanly instead of running through the row — see Placing dependencies.)
7. `mcp__leanix__commit_diagram_draft(draft_id="dr-123", name="SAP ↔ Oracle")` → `diagram_id`; then `mcp__leanix__get_diagram_by_id` → URL for the user.

Every cell ID came from `addedCells`; nothing persisted until step 7.

## Finding the entities

Pick the search tool by what the user filters on, then compose via the diagram tools.

| Query type | Action |
|---|---|
| Known entity name ("add SAP") | `mcp__leanix__search_fact_sheet_by_name(name)` — matches name only |
| Attribute-based ("EOL apps", "apps owned by X") | `mcp__leanix__text_to_fact_sheets(...)` — matches any attribute (lifecycle, owner, tags, …) |
| Domain/NL query needing routing ("finance apps", "HR systems") | Use the `fact-sheet-search` skill → follow its Quick Ref |

## Quick reference

| User intent | Action |
|---|---|
| Start a new diagram | `mcp__leanix__create_diagram_draft()` → use returned `draft_id` for all later calls |
| Edit an existing diagram | `mcp__leanix__create_diagram_draft(diagram_id)` → seeds the draft; use returned `draft_id` for all later calls |
| Add a fact sheet | Search → `mcp__leanix__add_diagram_fact_sheet_cell(draft_id, fact_sheet_id, x, y)` |
| Build a flat diagram (no relations) | `mcp__leanix__create_diagram_draft` → search → `mcp__leanix__add_diagram_fact_sheet_cell` (one or more) |
| Show dependencies of an entity | Entity on diagram → `mcp__leanix__get_workspace_context` → `mcp__leanix__add_diagram_dependencies(draft_id, cell_ids[], relation_name, x, y)` — `x`/`y` is the left-most dependency; the rest grow rightward, so anchor **below and clear of** the source with room (see Placing dependencies). |
| Drill down / expand an entity | Entity on diagram → `mcp__leanix__get_workspace_context` → `mcp__leanix__add_diagram_drill_down(draft_id, cell_ids[], relation_name)` |
| Show relations (unspecified) | Entity on diagram → `mcp__leanix__get_workspace_context` → pick dependencies vs drill-down (see Relation visualization) |
| Expand entities already on a diagram | Use cell IDs from the seeded draft XML or prior diffs → `mcp__leanix__add_diagram_drill_down(...)` / `mcp__leanix__add_diagram_dependencies(...)`. |
| Add a visual shape / label / annotation | `mcp__leanix__add_diagram_cell(draft_id, x, y, value, ...)` — plain vertex |
| Connect two cells visually | `mcp__leanix__add_diagram_edge(draft_id, source_cell_id, target_cell_id, ...)` — plain connector |
| Remove elements | Cell IDs from prior diffs → `mcp__leanix__remove_diagram_cells(draft_id, cell_ids[])`. Fact sheet cells auto-cascade their relation edges and drill-down children; for plain shapes, remove connected edges explicitly first. |
| Save / finish the diagram | `mcp__leanix__commit_diagram_draft(draft_id, name, description?)` → `diagram_id`, then output its URL. **Nothing is saved until you commit** (see lifecycle above for `name`/`description` semantics). |

## Tool choice — LeanIX data vs plain visual

Golden rule 9 is the hard boundary: LeanIX data → fact-sheet tools; plain visuals → cell/edge tools. The reason is metadata: the plain `mcp__leanix__add_diagram_cell`/`mcp__leanix__add_diagram_edge` tools set no LeanIX metadata (`factSheetId`, `factSheetType`, `relationId`, relation type), so the platform will not recognize what they add as a fact sheet or relation. The fact-sheet tools are the primary path — the vast majority of requests use them. Reach for the plain visual tools only when the thing is genuinely non-LeanIX:

1. **Enhancing a complex fact-sheet diagram** (10+ entities or multiple groups): titles, section/swimlane containers, legends, separators. For 1–5 entities keep it minimal — no extra visuals.
2. **Building a standalone non-fact-sheet diagram** (process, sequence, org/hierarchy, flowchart): compose entirely from `mcp__leanix__add_diagram_cell` + `mcp__leanix__add_diagram_edge`.

| Tool | Purpose | Use for | Never for |
|---|---|---|---|
| `mcp__leanix__add_diagram_fact_sheet_cell` | Fact sheet vertex (correct metadata + `leanix_fs_{Type}` style) | Any LeanIX entity the user names | — |
| `mcp__leanix__add_diagram_cell` | Plain vertex, no LeanIX metadata | Labels, annotations, headers, swimlane/section containers, legends, custom shapes | Fact sheets |
| `mcp__leanix__add_diagram_dependencies` | LeanIX relation edges (`type="relation"`, metadata, styling) | Real workspace relations between fact sheets | — |
| `mcp__leanix__add_diagram_edge` | Plain connector, no relation metadata | Arrows/lines between plain shapes, non-LeanIX flow indicators | Fact sheet relations |
| `mcp__leanix__update_diagram_cell` | Change label/style/geometry of a **non-fact-sheet** cell (only fields you pass) | Rename/restyle/move/resize a visual cell already on the diagram | Fact sheet cells (LeanIX-managed) |

Prefer setting all properties in the initial `mcp__leanix__add_diagram_cell` call; use `mcp__leanix__update_diagram_cell` only for later edits. A cell's `value` MAY contain literal HTML to style its text (`<b>`, `<br>`, `<font color="...">`, …) — always raw, never escaped (Golden rule 4) — paired with `html=1` in the `style`.

**Make every non-LeanIX visual look polished — never leave it bare.** When you add a legend, box, title, summary, or annotation, use the full styling vocabulary from `xml-convention.md`:

- **Depth & shape:** `rounded=1` with `arcSize` for soft corners, `shadow=1` for lift, `strokeWidth` for a defined border.
- **Color:** a subtle `fillColor` + matching `strokeColor` pair, or a `gradientColor`/`gradientDirection` fill; use `light-dark(#light,#dark)` `fontColor` so text stays readable in both themes.
- **Text hierarchy:** `fontSize`/`fontStyle` (bold titles, smaller body), HTML `<b>`/`<br>`/`<font>` for inline emphasis, `align`/`verticalAlign` and `spacing*` padding so text sits comfortably inside its box.
- **Sizing:** size the container to its content. Text elements (summaries, legends, multi-line labels) need enough **height** for every wrapped line — a too-short box overlaps its own text. When unsure, make the container taller, and set `whiteSpace=wrap` for anything multi-line.

Example strings: vertex `rounded=1;arcSize=8;fillColor=#f5f5f5;strokeColor=#666666;strokeWidth=1;shadow=1;whiteSpace=wrap;html=1;verticalAlign=top;spacing=8;`, title `text;html=1;fontSize=18;fontStyle=1;align=left;`, edge `edgeStyle=orthogonalEdgeStyle;endArrow=classic;strokeColor=#6c8ebf;`. Load `xml-convention.md` for the full property catalog before composing a `style`.

## Relation visualization

Single-relation views ("what SAP depends on", "expand this app's IT components"). Both require the source fact sheet already on the diagram — if absent, `mcp__leanix__add_diagram_fact_sheet_cell` first.

| Tool | Visualization | Best for |
|---|---|---|
| `mcp__leanix__add_diagram_dependencies` | Connected nodes (arrow edges) | Peer/lateral relations, interfaces, data flows, many-to-many, cross-domain |
| `mcp__leanix__add_diagram_drill_down` | Children nested in a container | Compositional/hierarchical, "what X consists of", parent-child, part-of-whole |

**Choosing when style is unspecified:** compositional/hierarchical (app → its IT components, capability → sub-capabilities, org → child units) → `mcp__leanix__add_diagram_drill_down`; lateral/peer (app → apps it interfaces with, provider → apps it provides) → `mcp__leanix__add_diagram_dependencies`. Explicit "dependencies" → dependencies; explicit "drill down"/"expand into" → drill-down.

**Lean toward drill-down for a single relation off a single source.** When you are showing just ONE relation of ONE fact sheet, a drill-down is the more compact, cleaner view — the related fact sheets nest inside the source with no edges to route or overlap. Dependencies spread a wide row across the canvas and add edges that can cross other cells, so reserve them for when you genuinely need connecting lines: multiple relations in play, chains that connect onward (A → B → C), many-to-many, or an explicit "dependencies"/data-flow request. If in doubt and it is one relation from one source, drill down.

**Workflow:**

1. Is the source on the diagram? (Use the cell ID from the diff where you added it.) If not → `mcp__leanix__search_fact_sheet_by_name` → `mcp__leanix__add_diagram_fact_sheet_cell(draft_id, fact_sheet_id, x, y)`; read its `addedCells[].id`.
2. `mcp__leanix__get_workspace_context(include_meta_model=True, fact_sheet_types=[<type>])` → the type's relation fields list the exact directional relation names. Use one verbatim as `relation_name`.
3. `mcp__leanix__add_diagram_dependencies(...)` or `mcp__leanix__add_diagram_drill_down(...)`.

**Placing dependencies:** the `x`/`y` you pass to `mcp__leanix__add_diagram_dependencies` is the position of the **left-most** dependency; the rest lay out **to the right of it**, growing rightward regardless of what already occupies that space. You do NOT know the count in advance and it varies, so you MUST reserve room for the worst case (many dependencies).

- **ALWAYS place the source, then set the dependencies' `x` well to the right of it** — clear of the source and of anything already on the diagram — so a wide row has empty space to grow into and CANNOT overlap existing cells. NEVER anchor dependencies where content sits to their right.
- **Do NOT put the dependency row at the same `y` as the source.** When the source and its dependencies share a `y`, every edge runs straight through the horizontal band, crossing the source and the other dependency cells — it looks cluttered and the lines pile up. Offset the dependency row **below** the source (larger `y`), so the source sits above its fanned-out row of dependencies and edges drop cleanly downward into them without overlapping any cell. Think top-down: source on top, dependencies on the row beneath.
- When laying out **multiple** sources, give each source its own horizontal band (distinct `y`, same dependency `x`) with generous vertical spacing, so one source's rightward row never collides with another's.
- **Default when nothing else constrains it (soft rule):** a single call anchors one row that grows rightward — you cannot vary the `y` of individual dependencies within it. So for a simple single-source request, place the source at the top-left and anchor its dependency row below and to the right, with empty space to grow into. Override whenever the request, existing layout, or readability suggests otherwise.

**Collapsing a drill-down:** it toggles — call `mcp__leanix__add_diagram_drill_down` again on the same cell with the same `relation_name` to collapse it. NEVER remove drilled-down children with `mcp__leanix__remove_diagram_cells`.

## Failure modes

| Situation | What to do |
|---|---|
| `mcp__leanix__search_fact_sheet_by_name` → **0 results** | Retry **once** with `mcp__leanix__text_to_fact_sheets`. Still nothing → report "not found" and stop. Do NOT invent a `fact_sheet_id` or substitute a plain `mcp__leanix__add_diagram_cell`. |
| Search → **many** candidates | Pick the best name match and proceed. Do NOT ask the user to disambiguate. |
| `mcp__leanix__get_workspace_context` has **no matching relation** | Report which relations ARE available and stop. Do NOT guess a `relation_name` or fake it with `mcp__leanix__add_diagram_edge`. |
| Relation tool → **empty diff** (no `addedCells`) | Source has no related fact sheets for that relation. Report it; do NOT retry other relations unless asked. |
| Mutation tool → **error** | Surface it; do NOT silently retry the same call. Fix the cause first (e.g. a `cell_id` you no longer have — re-add the cell and use the new diff's ID). |
| A `cell_id` is **not found** | It was never added or already removed. Do NOT hunt for it — re-add the cell (or its relations) and use the ID from that diff. |

## References

You don't author XML, but `xml-convention.md`'s conventions govern what the tools produce, so you need them to choose correct `style` strings and geometry and to read cell shapes in a diff.

| Use case | File | Load when |
|---|---|---|
| XML convention | `xml-convention.md` | Setting or changing a cell's `style` (named styles, colors, shapes, edge routing), positioning/sizing cells, or interpreting the mxGraph cell shapes in a diff |
