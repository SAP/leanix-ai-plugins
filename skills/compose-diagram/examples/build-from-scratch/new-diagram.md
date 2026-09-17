# Build From Scratch

Building a brand-new diagram from named entities: open an unseeded draft, resolve
each entity by name, place it, then commit and hand back the URL.

---

## Transcript: "Diagram SAP and Oracle DB, side by side"

**User:** Put SAP and Oracle DB on a canvas next to each other.

**Agent reasoning:** Two named LeanIX entities, flat layout, no relations asked
for. Open a new draft (no `diagram_id`), search each name, place each as a fact
sheet cell, commit. Both are LeanIX entities, so `add_diagram_fact_sheet_cell` —
never `add_diagram_cell`.

1. **Open the draft**
   ```
   mcp__leanix__create_diagram_draft()
   → { draft_id: "dr-9f2", xml: "<mxGraphModel …/>" }   // unseeded → new diagram
   ```
   Thread `draft_id="dr-9f2"` through every call below.

2. **Resolve the names**
   ```
   mcp__leanix__search_fact_sheet_by_name(name="SAP")
   → { fact_sheet_id: "fs-sap-001", … }
   mcp__leanix__search_fact_sheet_by_name(name="Oracle DB")
   → { fact_sheet_id: "fs-ora-002", … }
   ```

3. **Place each fact sheet** (sequential — read each diff before the next)
   ```
   mcp__leanix__add_diagram_fact_sheet_cell(draft_id="dr-9f2", fact_sheet_id="fs-sap-001", x=20, y=20)
   → addedCells: [{ id: "2" }]     // "2" = SAP
   mcp__leanix__add_diagram_fact_sheet_cell(draft_id="dr-9f2", fact_sheet_id="fs-ora-002", x=200, y=20)
   → addedCells: [{ id: "3" }]     // "3" = Oracle DB, one column to the right, no overlap
   ```

4. **Commit** (unseeded draft → creates the diagram; `name`/`description` become title/description)
   ```
   mcp__leanix__commit_diagram_draft(draft_id="dr-9f2", name="SAP & Oracle DB")
   → { diagram_id: "dg-77" }
   ```

5. **Fetch the URL once and return it**
   ```
   mcp__leanix__get_diagram_by_id(diagram_id="dg-77")
   → { url: "https://demo.leanix.net/demo/diagrams/dg-77", … }
   ```

**Agent reply:** Done — SAP and Oracle DB are on a new canvas side by side:
https://demo.leanix.net/demo/diagrams/dg-77

---

## Points this illustrates

- **Transaction pair.** The draft opened in step 1 is committed in step 4, with
  mutations in between. No draft is ever opened just to read.
- **IDs come from diffs.** `"2"` and `"3"` were read from `addedCells`, not guessed.
- **No overlap.** SAP at `x=20` and Oracle at `x=200` leave clear horizontal spacing.
- **Fact-sheet tool, not plain cell.** Both are LeanIX entities → `add_diagram_fact_sheet_cell`.
- **URL fetched once** after commit and reused for any later edits to the same diagram.
