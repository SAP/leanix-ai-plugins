# Relation Visualization — dependencies vs drill-down

The two ways to visualize one relation off a source fact sheet, and how the skill
chooses between them.

| Tool | Visualization | Best for |
|------|---------------|----------|
| `add_diagram_dependencies` | Connected nodes (arrow edges) | Peer/lateral relations, data flows, many-to-many |
| `add_diagram_drill_down` | Children nested inside a container | Compositional/hierarchical, "what X consists of" |

**Rule of thumb:** for ONE relation off ONE source, lean toward drill-down — it is
more compact and adds no edges to route. Reach for dependencies when the request
says "dependencies"/"data flow", or when lines need to connect onward.

---

## Transcript A — dependencies ("what does SAP depend on")

**User:** Show SAP's dependencies.

**Agent reasoning:** Explicit "dependencies" → `add_diagram_dependencies`. Source
must be on the diagram first. Anchor the dependency row **below and well to the
right** of SAP so the fanned-out row has room to grow and edges drop cleanly down.

```
mcp__leanix__create_diagram_draft()
→ { draft_id: "dr-1a" }

mcp__leanix__search_fact_sheet_by_name(name="SAP")
→ { fact_sheet_id: "fs-sap-001" }

mcp__leanix__add_diagram_fact_sheet_cell(draft_id="dr-1a", fact_sheet_id="fs-sap-001", x=40, y=40)
→ addedCells: [{ id: "2" }]                       // SAP at top-left

mcp__leanix__get_workspace_context(include_meta_model=True, fact_sheet_types=["Application"])
→ … relApplicationToITComponent, relApplicationToDataObject, …   // pick the exact name

mcp__leanix__add_diagram_dependencies(draft_id="dr-1a", cell_ids=["2"], relation_name="relApplicationToITComponent", x=40, y=240)
→ addedCells: [ …dependency cells… + relation edges ]   // row anchored below SAP, grows rightward

mcp__leanix__commit_diagram_draft(draft_id="dr-1a", name="SAP dependencies")
→ { diagram_id: "dg-1a" }
mcp__leanix__get_diagram_by_id(diagram_id="dg-1a") → { url: "…/dg-1a" }
```

**Reply:** Here are SAP's IT-component dependencies: …/dg-1a

---

## Transcript B — drill-down ("what is SAP made of")

**User:** Drill down into SAP's IT components.

**Agent reasoning:** Compositional / "expand into" → `add_diagram_drill_down`. No
`x`/`y` — children nest inside the source. It toggles: calling it again with the
same `relation_name` collapses it.

```
mcp__leanix__create_diagram_draft()
→ { draft_id: "dr-1b" }

mcp__leanix__search_fact_sheet_by_name(name="SAP")
→ { fact_sheet_id: "fs-sap-001" }

mcp__leanix__add_diagram_fact_sheet_cell(draft_id="dr-1b", fact_sheet_id="fs-sap-001", x=40, y=40)
→ addedCells: [{ id: "2" }]

mcp__leanix__get_workspace_context(include_meta_model=True, fact_sheet_types=["Application"])
→ … relApplicationToITComponent …

mcp__leanix__add_diagram_drill_down(draft_id="dr-1b", cell_ids=["2"], relation_name="relApplicationToITComponent")
→ addedCells: [ …child cells nested inside "2"… ]     // no edges to route

mcp__leanix__commit_diagram_draft(draft_id="dr-1b", name="SAP composition")
→ { diagram_id: "dg-1b" }
mcp__leanix__get_diagram_by_id(diagram_id="dg-1b") → { url: "…/dg-1b" }
```

**Reply:** SAP expanded into its IT components: …/dg-1b

---

## Points this illustrates

- **Source first.** Both flows place the source fact sheet, then read its cell ID
  from the diff, before adding relations.
- **`get_workspace_context` before relating** — the exact directional relation name
  comes from the meta model, never guessed.
- **Placement of dependencies.** The dependency row is anchored below the source
  (`y=240` vs source `y=40`) and to the right, so edges drop down without crossing.
- **Choice of tool.** Explicit "dependencies" → dependencies; "drill down"/"expand
  into" / compositional → drill-down. When unspecified and it is one relation off
  one source, prefer drill-down.
