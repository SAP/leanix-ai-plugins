# Editing a Seeded Draft

Changing a diagram that already exists: seed the draft from its `diagram_id`, read
existing cell IDs from the seed XML, mutate, then commit as a new version.

---

## Transcript: "Add Salesforce to the existing landscape diagram and connect it to SAP"

**User:** On my "Core Landscape" diagram (id `dg-77`), add Salesforce and link it
to SAP as a dependency.

**Agent reasoning:** This edits an existing diagram → seed the draft with its
`diagram_id`. The seed XML is the read-only source for existing cell IDs (SAP is
already on it). Salesforce is a LeanIX entity → `add_diagram_fact_sheet_cell`. A
real relation between two fact sheets → `add_diagram_dependencies`, even though
both cells are on the diagram — never a plain `add_diagram_edge`.

1. **Seed the draft**
   ```
   mcp__leanix__create_diagram_draft(diagram_id="dg-77")
   → { draft_id: "dr-ed1", xml: "<mxGraphModel> … <object … id='2' factSheetId='fs-sap-001'/> … </mxGraphModel>" }
   ```
   From the seed XML: SAP is cell `id="2"`.

2. **Resolve and place Salesforce**
   ```
   mcp__leanix__search_fact_sheet_by_name(name="Salesforce")
   → { fact_sheet_id: "fs-sfdc-050" }
   mcp__leanix__add_diagram_fact_sheet_cell(draft_id="dr-ed1", fact_sheet_id="fs-sfdc-050", x=300, y=40)
   → addedCells: [{ id: "14" }]     // placed clear of existing cells
   ```

3. **Connect them as a real relation**
   ```
   mcp__leanix__get_workspace_context(include_meta_model=True, fact_sheet_types=["Application"])
   → … relApplicationToApplication (interfaces) …
   mcp__leanix__add_diagram_dependencies(draft_id="dr-ed1", cell_ids=["2"], relation_name="relApplicationToApplication", x=300, y=240)
   → addedCells: [ …Salesforce already present is reused / relation edge added… ]
   ```

4. **Commit as a version** (seeded draft → updates `dg-77`; `description` is the
   version message stating WHY, not WHAT)
   ```
   mcp__leanix__commit_diagram_draft(draft_id="dr-ed1", name="Core Landscape", description="Add Salesforce and its interface to SAP")
   → { diagram_id: "dg-77" }
   ```

**Agent reply:** Salesforce is on the Core Landscape diagram and linked to SAP.
(URL reused from the earlier fetch — the `diagram_id` never changes.)

---

## Points this illustrates

- **Seeded draft.** Passing `diagram_id` seeds the draft; committing it updates
  that diagram rather than creating a new one.
- **Existing IDs from the seed XML.** SAP's `id="2"` was read from the seed XML —
  the diagram is never re-read mid-edit to find an ID.
- **`name` still required on a seeded commit** (it has no effect but must be passed
  — the existing name), and **`description` is the version message** (the WHY).
- **Relation, not plain edge.** Two fact sheets are connected with
  `add_diagram_dependencies`, never `add_diagram_edge` — that would carry no
  LeanIX relation metadata.
