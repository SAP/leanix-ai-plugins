# Geography / Organization Filter Examples

Geography in LeanIX is modelled via **Organization** fact sheets (countries, regions, legal entities). In some workspaces, it is called UserGroup instead of Organization, but the concept is the same.
Applications and ITComponents link to Organizations via `relApplicationToOrganization` and `relITComponentToOrganization`.

---

## Decision flow

```
Query mentions a geographic place or org name?
  │
  ├─ Try fullTextSearch on Organization type to find matching fact sheet UUIDs
  │     → If one or more UUIDs found: Pattern A (filter by UUID — use ALL returned UUIDs)
  │     → If not found: Pattern B (subFilter fullTextSearch fallback)
  │
  └─ Multiple places mentioned?
        → "used in both Spain AND France": Pattern C (AND logic, two UUIDs)
        → "used in Spain OR France":       Pattern A (two keys in one OR filter)
```

---

## Pattern A — specific Organization found by UUID

The resolve step may return **more than one** Organization (e.g. "Italy" and "Italy / Marketing" are both returned when searching for "Italy"). **Use ALL returned UUIDs in the `keys` array** — omitting any sub-org will miss applications linked only to that sub-org.

```graphql
# "applications used in Italy" — resolve step returned TWO orgs: "Italy" and "Italy / Marketing":
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "relApplicationToOrganization"
          operator: OR
          keys: [
            "6890f3b3-3be5-420c-9650-3ae467fd53b8"
            "e4488a8d-a810-4c3a-a8c0-a77153051c4c"
          ]
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

## Pattern B — no specific Organization found (fallback subFilter)

When a geographic term like "Europe" has no single matching Organization UUID, use `subFilter: { fullTextSearch: "<term>" }` to match any Organization whose name contains the term:

```graphql
# "solutions used in Europe" — no single "Europe" Organization UUID found:
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application", "ITComponent"] }
        {
          facetKey: "relApplicationToOrganization"
          operator: OR
          keys: []
          subFilter: { fullTextSearch: "Europe" }
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

Note: `keys: []` means "any related Organization, filtered by subFilter". The `subFilter.fullTextSearch` matches on the Organization fact sheet's name/description, not on the application's fields.

---

## Pattern C — "common to both" (used by Spain AND France)

For "common software used by both Spain and France", use a single `relApplicationToOrganization` filter with both UUIDs. The API applies AND logic when multiple keys are provided to the same relation facet:

```graphql
# "common software used by both Spain and France":
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "relApplicationToOrganization"
          operator: OR
          keys: [
            "b7c2b92d-4c1c-4018-96bc-88ffd478fb17"
            "1c3ef333-5cc1-414d-ba3e-108af7f0ffc4"
          ]
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

## Combined: Geography + BusinessCapability

"Applications used in Spain for Finance":

```graphql
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "relApplicationToOrganization"
          operator: OR
          keys: ["b7c2b92d-4c1c-4018-96bc-88ffd478fb17"]
        }
        {
          facetKey: "relApplicationToBusinessCapability"
          operator: OR
          keys: ["9aa297ff-4177-47f5-8ccf-b3b67a73d63b"]
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

## "NOT used in HQ" (negation)

Negation + subFilter is forbidden — use a two-step approach: first find all apps linked to any Organization, then note the limitation:

```graphql
# Step 1: apps used in any organization (positive side):
{
  facetKey: "relApplicationToOrganization"
  operator: OR
  keys: []
  subFilter: { facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["Organization"] }] }
}
# Then note: cannot exclude HQ in the same query — NOR + subFilter is not supported.
```

If the HQ UUID is known, use `operator: NOR` on the relation facet (without subFilter):
```graphql
# "apps NOT linked to Headquarter" (UUID known):
{ facetKey: "relApplicationToOrganization", operator: NOR, keys: ["2d570bfb-1569-41f2-9037-8897adb94469"] }
```

---

## Vocabulary mapping

| User says | LeanIX concept | Relation facet |
|---|---|---|
| used in Spain / France / Germany | Organization (country) | `relApplicationToOrganization` |
| used in Europe / APAC / EMEA | Organization (region) — use subFilter fallback | `relApplicationToOrganization` |
| used by headquarter / org unit | Organization | `relApplicationToOrganization` |
| legal entity / subsidiary | Organization | `relApplicationToOrganization` |
| location, country (on ITComponent) | `relITComponentToOrganization` | `relITComponentToOrganization` |

Do NOT use `facetKey: "location"` — location is a field on some fact sheet types but is not a reliable filter for geographic ownership queries.
