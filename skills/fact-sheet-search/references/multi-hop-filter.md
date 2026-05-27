# Multi-Hop / subFilter Examples

A subFilter constrains **which related fact sheets count** toward the parent facet filter.
Always use `keys: []` on the parent relation facet + `subFilter` in a literal query body (not an inline default).

subFilter has **one level of depth** — you cannot put a `subFilter` inside a `subFilter`.
For three-type traversal (e.g. App→Interface→ITComponent), resolve the deepest UUID first, then pass it into the intermediate `subFilter.facetFilters`.

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

```graphql
# "apps with technology going out of life this year" — ITComponent lifecycle endOfLife in current year:
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
            facetFilters: [
              { facetKey: "FactSheetTypes", operator: OR, keys: ["ITComponent"] }
              { facetKey: "lifecycle", operator: OR, keys: ["endOfLife"], dateFilter: { type: RANGE, from: "2026-01-01", to: "2026-12-31" } }
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

## Decision table

| Query pattern | Use |
|---|---|
| "apps using .NET / SAP / Oracle" (by name) | Pattern A: `subFilter.fullTextSearch` |
| "apps supporting non-commodity BCs" (by field value) | Pattern B: `subFilter.facetFilters` with field facet |
| "apps with FTP interfaces" (three types) | Pattern C: resolve leaf UUID, pass to `subFilter.facetFilters` relation key |
| "apps with tech going out of life this year" | Pattern D: `subFilter.facetFilters` lifecycle + dateFilter |
| "orgs connected to apps owned by Person X" | Pattern E: two-step subscription + UUID subFilter |
