# Failure Handling

How the skill behaves when a search, a relation lookup, or a mutation doesn't
return what was expected. The rule throughout: **report and stop — never invent a
`fact_sheet_id`, guess a `relation_name`, or substitute a plain shape for a LeanIX
entity.**

---

## Transcript A — fact sheet not found

**User:** Add "Zephyr Payments Gateway" to a canvas.

```
mcp__leanix__create_diagram_draft()
→ { draft_id: "dr-f1" }

mcp__leanix__search_fact_sheet_by_name(name="Zephyr Payments Gateway")
→ { results: [] }                     // 0 results

# Golden rule: retry ONCE with the attribute search before giving up
mcp__leanix__text_to_fact_sheets(text="Zephyr Payments Gateway")
→ { results: [] }                     // still nothing
```

**Agent reply:** I couldn't find a fact sheet named "Zephyr Payments Gateway" in
your workspace (searched by name and by attribute). Nothing was placed. If it goes
by a different name, tell me and I'll add it.

> The draft `dr-f1` had no mutation, so it is abandoned without committing — never
> commit an empty draft (it would save an empty diagram). It is never invented as a
> plain `add_diagram_cell` either.

---

## Transcript B — search returns many candidates

**User:** Add "Portal".

```
mcp__leanix__search_fact_sheet_by_name(name="Portal")
→ { results: [ {id:"fs-a", name:"Customer Portal"}, {id:"fs-b", name:"Partner Portal"}, … ] }
```

**Agent reasoning:** Many matches → pick the best name match and proceed; do NOT
stall the user with a disambiguation prompt. "Portal" alone → take the closest, place
it, and let the user correct after seeing it.

```
mcp__leanix__add_diagram_fact_sheet_cell(draft_id="dr-f2", fact_sheet_id="fs-a", x=20, y=20)
→ addedCells: [{ id: "2" }]
```

**Agent reply:** I placed "Customer Portal" (closest match to "Portal"). Want a
different one? I can swap it.

---

## Transcript C — no matching relation

**User:** Show SAP's "hosted on" relations.

```
mcp__leanix__add_diagram_fact_sheet_cell(draft_id="dr-f3", fact_sheet_id="fs-sap-001", x=40, y=40)
→ addedCells: [{ id: "2" }]

mcp__leanix__get_workspace_context(include_meta_model=True, fact_sheet_types=["Application"])
→ relations: [ relApplicationToITComponent, relApplicationToDataObject, relApplicationToProvider ]
                                          # no "hosted on" relation exists
```

**Agent reply:** There's no "hosted on" relation on Application in this workspace.
The available relations are: IT Components, Data Objects, and Providers. Which of
those would you like me to visualize? (No relation was faked with a plain edge.)

---

## Transcript D — relation returns an empty diff

**User:** Expand SAP into its Data Objects.

```
mcp__leanix__get_workspace_context(include_meta_model=True, fact_sheet_types=["Application"])
→ … relApplicationToDataObject …

mcp__leanix__add_diagram_drill_down(draft_id="dr-f4", cell_ids=["2"], relation_name="relApplicationToDataObject")
→ addedCells: []                      // empty diff — SAP has no related Data Objects
```

**Agent reply:** SAP has no Data Objects linked in the workspace, so there's
nothing to expand. I left the diagram as-is. I did not retry other relations — say
the word if you'd like me to try a different one.

---

## Points this illustrates

- **0 results → retry once with `text_to_fact_sheets`, then stop.** Never invent an ID.
- **Many results → pick the best match and proceed**, letting the user refine.
- **No matching relation → report what IS available and stop.** Never guess a
  `relation_name` or fake it with `add_diagram_edge`.
- **Empty relation diff → report "nothing to show" and stop.** Don't retry other
  relations unless asked.
- **Never commit an empty draft.** A draft with no mutation is abandoned, not committed.
