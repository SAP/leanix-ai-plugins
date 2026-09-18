# Plain Visuals (non-LeanIX)

A standalone diagram with no LeanIX entities — built entirely from plain cells and
edges. This is the ONLY place the plain `add_diagram_cell` / `add_diagram_edge`
tools are used: the shapes carry no `factSheetId`, so they must not stand in for
LeanIX entities.

---

## Transcript: "Draw an approval flowchart"

**User:** Make me a simple approval flowchart: Request → Review → (Approved / Rejected).

**Agent reasoning:** Nothing here is a LeanIX fact sheet — it's a generic process
diagram. Compose it from `add_diagram_cell` (vertices) + `add_diagram_edge`
(connectors). Style the decision node as a rhombus, give boxes room, route edges
orthogonally. Set styling in the initial `add_diagram_cell` call rather than
patching later with `update_diagram_cell`.

1. **Open a new draft**
   ```
   mcp__leanix__create_diagram_draft()
   → { draft_id: "dr-fc" }
   ```

2. **Place the plain shapes** (sequential; read each `id` from its diff)
   ```
   mcp__leanix__add_diagram_cell(draft_id="dr-fc", x=40, y=40, value="Request",
       style="rounded=1;arcSize=8;fillColor=#dae8fc;strokeColor=#6c8ebf;whiteSpace=wrap;html=1;")
   → addedCells: [{ id: "2" }]
   mcp__leanix__add_diagram_cell(draft_id="dr-fc", x=40, y=140, value="Review",
       style="rounded=1;arcSize=8;fillColor=#dae8fc;strokeColor=#6c8ebf;whiteSpace=wrap;html=1;")
   → addedCells: [{ id: "3" }]
   mcp__leanix__add_diagram_cell(draft_id="dr-fc", x=40, y=240, value="Approved?",
       style="rhombus;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;")
   → addedCells: [{ id: "4" }]
   mcp__leanix__add_diagram_cell(draft_id="dr-fc", x=-120, y=360, value="<b>Approved</b>",
       style="rounded=1;fillColor=#d5e8d4;strokeColor=#82b366;html=1;")
   → addedCells: [{ id: "5" }]           // note: <b> passed raw, never &lt;b&gt;
   mcp__leanix__add_diagram_cell(draft_id="dr-fc", x=200, y=360, value="<b>Rejected</b>",
       style="rounded=1;fillColor=#f8cecc;strokeColor=#b85450;html=1;")
   → addedCells: [{ id: "6" }]
   ```

3. **Wire them with plain edges** (using the IDs from step 2's diffs)
   ```
   mcp__leanix__add_diagram_edge(draft_id="dr-fc", source_cell_id="2", target_cell_id="3",
       style="edgeStyle=orthogonalEdgeStyle;endArrow=classic;")
   mcp__leanix__add_diagram_edge(draft_id="dr-fc", source_cell_id="3", target_cell_id="4",
       style="edgeStyle=orthogonalEdgeStyle;endArrow=classic;")
   mcp__leanix__add_diagram_edge(draft_id="dr-fc", source_cell_id="4", target_cell_id="5",
       style="edgeStyle=orthogonalEdgeStyle;endArrow=classic;")
   mcp__leanix__add_diagram_edge(draft_id="dr-fc", source_cell_id="4", target_cell_id="6",
       style="edgeStyle=orthogonalEdgeStyle;endArrow=classic;")
   ```

4. **Commit and return the URL**
   ```
   mcp__leanix__commit_diagram_draft(draft_id="dr-fc", name="Approval flow")
   → { diagram_id: "dg-fc" }
   mcp__leanix__get_diagram_by_id(diagram_id="dg-fc") → { url: "…/dg-fc" }
   ```

**Agent reply:** Here's the approval flowchart: …/dg-fc

---

## Points this illustrates

- **Plain tools for non-LeanIX shapes only.** No `factSheetId` involved → the plain
  cell/edge tools are correct here. They would be WRONG for a LeanIX entity.
- **Raw HTML in `value`.** `<b>Approved</b>` is passed literally with `html=1` in
  the style — never XML-escaped to `&lt;b&gt;`, which would render as visible text.
- **Style up front.** All appearance set in the initial `add_diagram_cell` call;
  `update_diagram_cell` is reserved for later edits.
- **Edges reference diff IDs.** Every `source_cell_id` / `target_cell_id` is an ID
  read from an earlier `addedCells` entry.
