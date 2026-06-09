# GraphQL allFactSheets Filter Examples

Complete query examples for each filter pattern. Use these as templates when building your query.

---

## UUID / exact ID lookup

Use `ids` on the FilterInput root — `fullTextSearch` does NOT match on UUIDs.

```graphql
# "find fact sheet with ID 728926ed-...":
query FactSheetSearch {
  allFactSheets(
    filter: { responseOptions: { maxFacetDepth: 5 }, ids: ["728926ed-e9aa-4ec2-b790-875e39792a58"] }
    first: 1
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

---

## Name / keyword search — always include FactSheetTypes

Without a type filter, `fullTextSearch`/`quickSearch` returns every matching type (hundreds of results). Always narrow:

```graphql
# "find applications named 'AC Management'" — fullTextSearch (exact/brand name):
query FactSheetSearch($filter: FilterInput = {
  responseOptions: { maxFacetDepth: 5 }
  facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }]
  fullTextSearch: "AC Management"
}) {
  allFactSheets(filter: $filter, first: 50) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}

# "find applications matching 'SAP Conc'" — quickSearch (fuzzy name-only match):
query FactSheetSearch($filter: FilterInput = {
  responseOptions: { maxFacetDepth: 5 }
  facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }]
  quickSearch: "SAP Conc"
}) {
  allFactSheets(filter: $filter, first: 50) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

---

## Lifecycle phase filter

Requires `dateFilter` — the backend rejects lifecycle filters without it.

"Planning to retire" / "phasing out" queries should include **all types that can have a lifecycle**, not just Application:

```graphql
# "software planning to retire" — includes Application AND ITComponent:
query FactSheetSearch($filter: FilterInput = {
  responseOptions: { maxFacetDepth: 5 }
  facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["Application", "ITComponent"] }
    { facetKey: "lifecycle", operator: OR, keys: ["phaseOut"], dateFilter: { type: TODAY } }
  ]
}) {
  allFactSheets(filter: $filter, first: 50) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}

# "apps phasing out today" (Application only):
query FactSheetSearch($filter: FilterInput = {
  responseOptions: { maxFacetDepth: 5 }
  facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
    { facetKey: "lifecycle", operator: OR, keys: ["phaseOut"], dateFilter: { type: TODAY } }
  ]
}) {
  allFactSheets(filter: $filter, first: 50) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}

# "apps phasing out OR end of life":
query FactSheetSearch($filter: FilterInput = {
  responseOptions: { maxFacetDepth: 5 }
  facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
    { facetKey: "lifecycle", operator: OR, keys: ["phaseOut", "endOfLife"], dateFilter: { type: TODAY } }
  ]
}) {
  allFactSheets(filter: $filter, first: 50) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}

# "apps retiring in 2027":
query FactSheetSearch($filter: FilterInput = {
  responseOptions: { maxFacetDepth: 5 }
  facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
    { facetKey: "lifecycle", operator: OR, keys: ["phaseOut"], dateFilter: { type: RANGE_STARTS, from: "2027-01-01", to: "2027-12-31" } }
  ]
}) {
  allFactSheets(filter: $filter, first: 50) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

---

## Approval / lxState filter

```graphql
# "rejected applications":
query FactSheetSearch($filter: FilterInput = {
  responseOptions: { maxFacetDepth: 5 }
  facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
    { facetKey: "lxState", operator: OR, keys: ["REJECTED"] }
  ]
}) {
  allFactSheets(filter: $filter, first: 50) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

Valid lxState keys: `"DRAFT"`, `"APPROVED"`, `"REJECTED"`, `"BROKEN_QUALITY_SEAL"`.
- "rejected by quality seal" → `["REJECTED"]` only
- "broken quality seal" → `["BROKEN_QUALITY_SEAL"]`

---

## Archived / trash bin items

Use `TrashBin` facet key — NOT `lxState`. This is the only way to query archived fact sheets.

```graphql
# "applications in the trash bin":
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        { facetKey: "TrashBin", operator: OR, keys: ["archived"] }
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

## Subscription / ownership filter

```graphql
# "applications missing a responsible person":
query FactSheetSearch($filter: FilterInput = {
  responseOptions: { maxFacetDepth: 5 }
  facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
    { facetKey: "Subscriptions", operator: OR, keys: ["__missing__"], subscriptionFilter: { type: "RESPONSIBLE" } }
  ]
}) {
  allFactSheets(filter: $filter, first: 50) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}

# "applications that have a responsible" (negation of missing):
query FactSheetSearch($filter: FilterInput = {
  responseOptions: { maxFacetDepth: 5 }
  facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
    { facetKey: "Subscriptions", operator: NOR, keys: ["__missing__"], subscriptionFilter: { type: "RESPONSIBLE" } }
  ]
}) {
  allFactSheets(filter: $filter, first: 50) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

Note: Named-person lookup ("Frank Martin as responsible") requires a user UUID. The API cannot resolve display names to UUIDs. Report: "Filtering by a specific person's name requires a user UUID that is not available here."

---

## Multi-hop / subFilter examples

Use `keys: []` on the parent relation facet + `subFilter` — means "any related FS, filtered by subFilter".
Because `subFilter` cannot appear in an inline default value, pass the full filter as a literal in the query body.

```graphql
# "applications running on .NET technology" (App → ITComponent named .NET):
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
  ) { edges { node { id displayName type } } totalCount pageInfo { hasNextPage endCursor } }
}

# "applications with FTP interfaces" (App → Interface → ITComponent with FTP technology):
# Two-step: first find the FTP ITComponent UUID, then filter App → Interface → ITComponent(uuid)
# Step 1: query { allFactSheets(filter: { facetFilters: [{ facetKey: "FactSheetTypes", keys: ["ITComponent"] }], fullTextSearch: "FTP" }, first: 1) { edges { node { id } } } }
# Step 2 (provider side):
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
              { facetKey: "relInterfaceToITComponent", operator: OR, keys: ["<ftp-itcomponent-uuid>"] }
            ]
          }
        }
      ]
    }
    first: 50
  ) { edges { node { id displayName type } } totalCount pageInfo { hasNextPage endCursor } }
}

# "applications used in Europe" (App → Organization in Europe):
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "relApplicationToOrganization"
          operator: OR
          keys: []
          subFilter: {
            facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["Organization"] }]
            fullTextSearch: "Europe"
          }
        }
      ]
    }
    first: 50
  ) { edges { node { id displayName type } } totalCount pageInfo { hasNextPage endCursor } }
}

# "applications storing sensitive data" (App → DataObject with sensitive classification):
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
  ) { edges { node { id displayName type } } totalCount pageInfo { hasNextPage endCursor } }
}

# "apps supporting non-commodity capabilities" (App → BusinessCapability with non-commodity strategic importance):
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
  ) { edges { node { id displayName type } } totalCount pageInfo { hasNextPage endCursor } }
}
```

subFilter constraints:
- `keys: []` on the parent is required (means "any related FS")
- Only valid on relation facet keys, not field facets
- `subFilter.facetFilters` supports the same facet keys as the top level
- Only one level of nesting — no `subFilter` inside a `subFilter`
- Do NOT combine `operator: NOR` with `subFilter`

---

## Missing relation (negation)

```graphql
# "applications without IT components":
query FactSheetSearch($filter: FilterInput = {
  responseOptions: { maxFacetDepth: 5 }
  facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
    { facetKey: "relApplicationToITComponent", operator: NOR, keys: [] }
  ]
}) {
  allFactSheets(filter: $filter, first: 50) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

---

## Structured field facet filters

```graphql
# "applications missing technical suitability rating":
query FactSheetSearch($filter: FilterInput = {
  responseOptions: { maxFacetDepth: 5 }
  facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
    { facetKey: "technicalSuitability", operator: OR, keys: ["__missing__"] }
  ]
}) {
  allFactSheets(filter: $filter, first: 50) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}

# "applications with inadequate technical suitability":
query FactSheetSearch($filter: FilterInput = {
  responseOptions: { maxFacetDepth: 5 }
  facetFilters: [
    { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
    { facetKey: "technicalSuitability", operator: OR, keys: ["inadequate"] }
  ]
}) {
  allFactSheets(filter: $filter, first: 50) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

Valid keys: `"inadequate"`, `"adequate"`, `"fullyAppropriate"`, `"unreasonable"`, `"__missing__"`.

---

## Numeric/threshold queries (completion %, TCO)

The API has no numeric range filter. Use sort + large `first:` and return all results:

```graphql
# "applications below 40% completion":
query FactSheetSearch($filter: FilterInput = {
  responseOptions: { maxFacetDepth: 5 }
  facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }]
}) {
  allFactSheets(filter: $filter, first: 200, sort: [{ mode: BY_FIELD, key: "completion", order: asc }]) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

---

## Pagination

When `pageInfo.hasNextPage` is true, fetch the next page by adding `after`:

```graphql
query FactSheetSearch {
  allFactSheets(
    filter: { responseOptions: { maxFacetDepth: 5 }, facetFilters: [...] }
    first: 50
    after: "CURSOR_FROM_PREVIOUS_PAGE"
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

Paginate when the user asks for ALL items ("all", "list all", "how many", "which ones", complete counts, or threshold queries like "below 40%"). The structured `results` list must include IDs from every page.

---

## Single fact sheet with relations

Use the `factSheet` query (not `allFactSheets`) when you have a UUID and need to traverse relations:

```graphql
# "show IT components used by application <UUID>":
query {
  factSheet(id: "728926ed-e9aa-4ec2-b790-875e39792a58") {
    id
    displayName
    ... on Application {
      relApplicationToITComponent {
        edges {
          node {
            factSheet { id displayName type }
          }
        }
      }
    }
  }
}
```

Use inline fragments (`... on Application`) to access type-specific relation fields.

---

## Intentionally empty relations (naFields)

Use `naFields` to find fact sheets where a relation was explicitly marked "Leave Empty on Purpose" — distinct from `__missing__` (relation never set).

```graphql
# "applications with IT component relation intentionally empty":
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      naFields: ["relApplicationToITComponent"]
      facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }]
    }
    first: 50
  ) {
    edges { node { id displayName type } }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

Trigger words: "intentionally empty", "marked as N/A", "left empty on purpose", "no IT component assigned on purpose".
