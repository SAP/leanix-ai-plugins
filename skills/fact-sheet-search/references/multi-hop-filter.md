# Multi-Hop / subFilter Examples

A subFilter constrains **which related fact sheets count** toward the parent facet filter.
Always use `keys: []` on the parent relation facet + `subFilter` in a literal query body (not an inline default).

subFilter has **one level of depth** — you cannot put a `subFilter` inside a `subFilter`.
For three-type traversal (e.g. App→Interface→ITComponent), resolve the deepest UUID first, then pass it into the intermediate `subFilter.facetFilters`.

**NOR operator — two distinct uses:**

| `operator: NOR` + `keys` | Meaning |
|---|---|
| `keys: []` | Exclude fact sheets that have **any** relation of this type (relation missing entirely) |
| `keys: ["<uuid>"]` | Exclude fact sheets linked to **that specific** related fact sheet |

Never confuse these two — they produce opposite result sets for fact sheets that have the relation.

---

## Pattern A — related FS matched by name / text

Use `subFilter.fullTextSearch` when the related fact sheet is identified by its **display name** or **description text**.

```graphql
# "applications running on .NET" — ITComponent whose name contains ".NET":
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "relApplicationToITComponent"
          operator: OR
          keys: []
          subFilter: {
            facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["ITComponent"] }]
            fullTextSearch: ".NET"
          }
        }
      ]
    }
    first: 50
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

---

## Pattern B — related FS matched by field value

Use `subFilter.facetFilters` with a **field facet key** when filtering related fact sheets by a structured field (lifecycle phase, category, strategicImportance, dataClassification, etc.).

**NEVER use `subFilter.fullTextSearch` for field enum values** — it matches text in names/descriptions, not field values.

```graphql
# "apps supporting non-commodity capabilities" — BC where strategicImportance is differentiation or innovation:
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "relApplicationToBusinessCapability"
          operator: OR
          keys: []
          subFilter: {
            facetFilters: [
              { facetKey: "FactSheetTypes", operator: OR, keys: ["BusinessCapability"] }
              { facetKey: "strategicImportance", operator: OR, keys: ["differentiation", "innovation"] }
            ]
          }
        }
      ]
    }
    first: 50
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}

# "apps storing sensitive data" — DataObject where dataClassification is sensitive/restricted/confidential:
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "relApplicationToDataObject"
          operator: OR
          keys: []
          subFilter: {
            facetFilters: [
              { facetKey: "FactSheetTypes", operator: OR, keys: ["DataObject"] }
              { facetKey: "dataClassification", operator: OR, keys: ["sensitive", "restricted", "confidential"] }
            ]
          }
        }
      ]
    }
    first: 50
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

---

## Pattern C — three-type traversal via UUID (App → Interface → ITComponent)

When the query spans **three fact sheet types**, resolve the deepest UUID in a separate query first, then pass it into `subFilter.facetFilters` as a relation filter key.

Example: "applications with interfaces using FTP technology" (App → Interface → ITComponent(FTP))

**Step 1** — Find the FTP ITComponent UUID:
```graphql
query {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["ITComponent"] }]
      fullTextSearch: "FTP"
    }
    first: 5
  ) {
    edges { node { id displayName } }
  }
}
```

**Step 2** — Filter apps via provider interface linked to that ITComponent UUID:
```graphql
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "relProviderApplicationToInterface"
          operator: OR
          keys: []
          subFilter: {
            facetFilters: [
              { facetKey: "FactSheetTypes", operator: OR, keys: ["Interface"] }
              { facetKey: "relInterfaceToITComponent", operator: OR, keys: ["<ftp-uuid-from-step-1>"] }
            ]
          }
        }
      ]
    }
    first: 50
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

Also check the **consumer side** with `relConsumerApplicationToInterface` and union the results.

---

## Pattern D — related FS matched by lifecycle phase (lifecycle + dateFilter in subFilter)

`lifecycle` with `dateFilter` is valid inside `subFilter.facetFilters`, same syntax as at the top level.

Add `relationFieldsFilterOperator: INCLUSIVE` on the parent relation facet whenever `subFilter` uses a `dateFilter`. This ensures an app is included when **at least one** related fact sheet matches the date condition.

```graphql
# "apps with technology going out of life in 2026" — ITComponent enters endOfLife in 2026:
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "relApplicationToITComponent"
          operator: OR
          keys: []
          relationFieldsFilterOperator: INCLUSIVE
          subFilter: {
            facetFilters: [
              { facetKey: "FactSheetTypes", operator: OR, keys: ["ITComponent"] }
              { facetKey: "lifecycle", operator: OR, keys: ["endOfLife"], dateFilter: { type: RANGE_STARTS, from: "2026-01-01", to: "2026-12-31" } }
            ]
          }
        }
      ]
    }
    first: 50
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

Valid lifecycle keys inside subFilter: `"plan"`, `"phaseIn"`, `"active"`, `"phaseOut"`, `"endOfLife"`.
Valid dateFilter types: `TODAY`, `RANGE`, `RANGE_STARTS`, `RANGE_ENDS`, `END_OF_MONTH`, `END_OF_YEAR`.

- Use `RANGE_STARTS` when the query asks when a phase *begins* within a window (e.g. "going out of life in 2026" = endOfLife starts in 2026).
- Use `RANGE` when the query asks if a phase *overlaps* a window (e.g. "currently in endOfLife" or "active during 2025").

---

## Pattern E — Org → App → User (two-step with intermediate UUID list)

When the traversal is Org → App (subscription), use `search_users` to get the user UUID, then:
- Step 1: get all applications where the user is subscribed (via `Subscriptions` facet filter with user UUID)
- Step 2: filter organizations that have a relation to any of those application UUIDs (via `subFilter: { ids: [...app_uuids...] }`)

```graphql
# Step 1: get apps where Paula Watson (userId=abc) is responsible:
{ facetKey: "FactSheetTypes", keys: ["Application"] }
{ facetKey: "Subscriptions", operator: OR, keys: ["<paula-watson-userId>"], subscriptionFilter: { type: "RESPONSIBLE" } }

# Step 2: get orgs linked to those specific apps by UUID:
{
  facetKey: "relOrganizationToApplication"
  operator: OR
  keys: []
  subFilter: { ids: ["<app-uuid-1>", "<app-uuid-2>", ...] }
}
```

---

## Pattern F — exclude apps linked to a specific named org (NOR with UUID)

Use this when the query **excludes** apps/software associated with a named organizational unit (e.g. "headquarters", "holding company", "parent org").

**Vocabulary:** natural-language terms like "headquarters" map to an Organization fact sheet. Resolve the name to a UUID first; then use `operator: NOR` with that UUID.

**The exclusion requires TWO separate facet entries on the same relation:**
- Entry 1: `operator: OR, keys: [], subFilter: ...` — requires *at least one* org link (so items with no org links at all are excluded)
- Entry 2: `operator: NOR, keys: ["<uuid>"]` — excludes items linked to the specific named org

**Step 1 — resolve the org name to a UUID:**

```graphql
# Try fullTextSearch first (exact or near-exact name match):
query ResolveOrg {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["Organization"] }]
      fullTextSearch: "Headquarter"
    }
    first: 5
  ) {
    edges { node { id displayName } }
  }
}
```

If `fullTextSearch` returns no results, fall back to `vector_search` with the concept term (e.g. "Headquarter").

**Step 2 — exclude software linked to that org UUID:**

**Relation facet keys are type-specific.** For "software"/"solutions" queries covering both Application and ITComponent, run two parallel `read_inventory` calls and merge the results. Each query also uses an OR+subFilter to require that the fact sheet has *at least one* org relation (so unlinked items are not included).

```graphql
# Query A — Applications used somewhere, but NOT at the named org
query AppsNotHQ {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "relApplicationToOrganization"
          operator: OR
          keys: []
          relationFieldsFilterOperator: INCLUSIVE
          subFilter: {
            facetFilters: [
              { facetKey: "FactSheetTypes", operator: OR, keys: ["Organization"] }
            ]
          }
        }
        { facetKey: "relApplicationToOrganization", operator: NOR, keys: ["<uuid-from-step-1>"] }
      ]
    }
    first: 500
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}

# Query B — ITComponents used somewhere, but NOT at the named org
query ITCompNotHQ {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["ITComponent"] }
        {
          facetKey: "relITComponentToOrganization"
          operator: OR
          keys: []
          relationFieldsFilterOperator: INCLUSIVE
          subFilter: {
            facetFilters: [
              { facetKey: "FactSheetTypes", operator: OR, keys: ["Organization"] }
            ]
          }
        }
        { facetKey: "relITComponentToOrganization", operator: NOR, keys: ["<uuid-from-step-1>"] }
      ]
    }
    first: 500
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

Merge the results from both queries (deduplicate by `id`). Use `first: 500` on each (do NOT paginate).

**WRONG — do NOT use `subFilter: { ids: [...] }` for exclusion.** This matches items *linked to* the UUID (inclusion), opposite of the intent:
```graphql
# ❌ WRONG — finds items linked TO the org, not excluding it:
{ facetKey: "relApplicationToOrganization", operator: OR, keys: [], subFilter: { ids: ["<uuid>"] } }

# ✅ CORRECT — separate NOR facet entry:
{ facetKey: "relApplicationToOrganization", operator: NOR, keys: ["<uuid>"] }
```

---

---

## Pattern G — apps common to multiple named orgs/countries (AND intersection)

Use when the query asks for apps used **by all** of a named set — "software used in both Spain and France", "apps common to Sales and Finance", "common software between two countries".

**The `keys` list must contain UUIDs — never literal names.** Always resolve names to UUIDs first (Step 1), then execute the AND intersection (Step 2). Step 1 is an intermediate step; you MUST proceed to Step 2 after it. Do NOT treat the UUID resolution as the final answer.

**Step 1 — resolve each name to a UUID in a single aliased query:**

```graphql
query ResolveOrgs {
  spain: allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["Organization"] }]
      fullTextSearch: "Spain"
    }
    first: 5
  ) { edges { node { id displayName } } }

  france: allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["Organization"] }]
      fullTextSearch: "France"
    }
    first: 5
  ) { edges { node { id displayName } } }
}
```

Collect the `id` from each alias result. If any name resolves to 0 results, try `vector_search` with that name.

**Step 2 — execute the AND intersection with the collected UUIDs:**

```graphql
query CommonSoftware {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application", "ITComponent"] }
        { facetKey: "relApplicationToOrganization", operator: AND, keys: ["<spain-uuid>", "<france-uuid>"] }
      ]
    }
    first: 500
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

`operator: AND` returns only fact sheets linked to **every** UUID in the list. Use `first: 500` — intersection result sets are often large.

**MANDATORY:** after completing Step 1 you MUST execute Step 2. Never return the UUID resolution results as the final answer — they are lookup data, not the answer to the question.

---

## Pattern H — initiatives (projects) linked to named applications

Use when the query asks for **projects / initiatives running around** a named technology or application (e.g. "projects around SAP", "initiatives for Salesforce"). The name identifies **Application** fact sheets; the answer is **Initiative** fact sheets linked to them.

**Step 1 — resolve the application name to UUIDs:**

```graphql
query ResolveApps {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }]
      fullTextSearch: "SAP"
    }
    first: 50
  ) {
    edges { node { id displayName } }
  }
}
```

If `fullTextSearch` returns 0 results, fall back to `vector_search("SAP")` to find matching application IDs.

**Step 2 — find Initiatives linked to those application UUIDs:**

```graphql
query InitiativesAroundSAP {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Initiative"] }
        {
          facetKey: "relInitiativeToApplication"
          operator: OR
          keys: ["<app-uuid-1>", "<app-uuid-2>", "<app-uuid-3>"]
          relationFieldsFilterOperator: INCLUSIVE
          subFilter: {
            facetFilters: [
              { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
            ]
          }
        }
      ]
    }
    first: 500
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

`keys` in the relation facet contains the **Application UUIDs** from Step 1 — the filter returns Initiatives linked to any of those applications. Use `first: 500` (do NOT paginate).

**Step 3 — precision tightening (ALWAYS run this):** Step 2 returns *any* Initiative that links to *at least one* of the named applications, including large cross-portfolio initiatives where the named technology is incidental. Apply the following checks in order:

**3a — complement query:** Run `fullTextSearch: "<name>"` on Initiatives and intersect with Step 2 results. Keep only Initiatives in both sets. If this intersection is non-empty, return it.

```graphql
# Complement — Initiatives that self-describe as being about SAP:
query InitiativesNamedSAP {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Initiative"] }
      ]
      fullTextSearch: "SAP"
    }
    first: 500
  ) {
    edges { node { id displayName type } }
    totalCount
  }
}
```

**3b — link-ratio filter (when 3a yields empty intersection):** For each Initiative UUID from Step 2, call `read_inventory` with the `factSheet` query to fetch its linked application IDs. Keep only initiatives where **every** linked application ID is in the Step 1 seed set (ratio = 1.0). Broad initiatives will have many links outside the seed — drop them. Focused SAP initiatives will have only SAP app links — keep them.

Run a separate `read_inventory` call per initiative (or batch them using GraphQL aliases):

```graphql
# Fetch linked apps for each initiative from Step 2 (batched with aliases):
query InitiativeLinks {
  init1: factSheet(id: "<initiative-uuid-1>") {
    id displayName
    ... on Initiative {
      relInitiativeToApplication {
        edges { node { factSheet { id displayName } } }
      }
    }
  }
  init2: factSheet(id: "<initiative-uuid-2>") {
    id displayName
    ... on Initiative {
      relInitiativeToApplication {
        edges { node { factSheet { id displayName } } }
      }
    }
  }
  # ... one alias per initiative
}
# For each initiative: if every linked app ID is in the Step 1 seed set → keep.
# If any linked app ID is outside the seed set → discard (SAP is incidental).
```

If no initiatives survive the ratio filter either, return the full Step 2 result.

---

## Decision table

| Query pattern | Use |
|---|---|
| "apps using .NET / SAP / Oracle" (by name) | Pattern A: `subFilter.fullTextSearch` |
| "apps supporting non-commodity BCs" (by field value) | Pattern B: `subFilter.facetFilters` with field facet |
| "apps with FTP interfaces" (three types) | Pattern C: resolve leaf UUID, pass to `subFilter.facetFilters` relation key |
| "apps with tech going out of life this year" | Pattern D: `subFilter.facetFilters` lifecycle + dateFilter |
| "orgs connected to apps owned by Person X" | Pattern E: two-step subscription + UUID subFilter |
| "apps used everywhere except \<named org\>" | Pattern F: resolve org name → UUID, then `operator: NOR, keys: [uuid]` |
| "software common to Spain and France" / "apps used in both X and Y" | Pattern G: resolve names → UUIDs, then `operator: AND, keys: [uuid1, uuid2]` |
| "projects/initiatives around SAP / Salesforce" (by linked app name) | Pattern H: resolve app name → UUIDs, then `relInitiativeToApplication, operator: OR, keys: [uuids]` |
