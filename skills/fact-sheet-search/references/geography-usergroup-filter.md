# Geography / UserGroup Filter Examples

Geography in LeanIX is modelled via **UserGroup** fact sheets (countries, regions, legal entities).
Applications and ITComponents link to UserGroups via `relApplicationToUserGroup` and `relITComponentToUserGroup`.

**NEVER use `relApplicationToOrganization`** — it does not exist in the standard LeanIX data model.

---

## Decision flow

```
Query mentions a geographic place or org name?
  │
  ├─ Try fullTextSearch on UserGroup type to find a matching fact sheet UUID
  │     → If UUID found: Pattern A (filter by UUID)
  │     → If not found: Pattern B (subFilter fullTextSearch fallback)
  │
  └─ Multiple places mentioned?
        → "used in both Spain AND France": Pattern C (AND logic, two UUIDs)
        → "used in Spain OR France":       Pattern A (two keys in one OR filter)
```

---

## Pattern A — specific UserGroup found by UUID

Use `keys: ["<uuid>"]` on the relation facet:

```graphql
# "applications used in Spain" — "Spain" UserGroup found with id "b7c2b92d-...":
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "relApplicationToUserGroup"
          operator: OR
          keys: ["b7c2b92d-4c1c-4018-96bc-88ffd478fb17"]
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

## Pattern B — no specific UserGroup found (fallback subFilter)

When a geographic term like "Europe" has no single matching UserGroup UUID, use `subFilter: { fullTextSearch: "<term>" }` to match any UserGroup whose name contains the term:

```graphql
# "solutions used in Europe" — no single "Europe" UserGroup UUID found:
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application", "ITComponent"] }
        {
          facetKey: "relApplicationToUserGroup"
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

Note: `keys: []` means "any related UserGroup, filtered by subFilter". The `subFilter.fullTextSearch` matches on the UserGroup fact sheet's name/description, not on the application's fields.

---

## Pattern C — "common to both" (used by Spain AND France)

For "common software used by both Spain and France", use a single `relApplicationToUserGroup` filter with both UUIDs. The API applies AND logic when multiple keys are provided to the same relation facet:

```graphql
# "common software used by both Spain and France":
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "relApplicationToUserGroup"
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
          facetKey: "relApplicationToUserGroup"
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

Negation + subFilter is forbidden — use a two-step approach: first find all apps linked to any UserGroup, then note the limitation:

```graphql
# Step 1: apps used in any organization (positive side):
{
  facetKey: "relApplicationToUserGroup"
  operator: OR
  keys: []
  subFilter: { facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["UserGroup"] }] }
}
# Then note: cannot exclude HQ in the same query — NOR + subFilter is not supported.
```

If the HQ UUID is known, use `operator: NOR` on the relation facet (without subFilter):
```graphql
# "apps NOT linked to Headquarter" (UUID known):
{ facetKey: "relApplicationToUserGroup", operator: NOR, keys: ["2d570bfb-1569-41f2-9037-8897adb94469"] }
```

---

## Vocabulary mapping

| User says | LeanIX concept | Relation facet |
|---|---|---|
| used in Spain / France / Germany | UserGroup (country) | `relApplicationToUserGroup` |
| used in Europe / APAC / EMEA | UserGroup (region) — use subFilter fallback | `relApplicationToUserGroup` |
| used by headquarter / org unit | UserGroup | `relApplicationToUserGroup` |
| legal entity / subsidiary | UserGroup | `relApplicationToUserGroup` |
| location, country (on ITComponent) | `relITComponentToUserGroup` | `relITComponentToUserGroup` |

Do NOT use `facetKey: "location"` — location is a field on some fact sheet types but is not a reliable filter for geographic ownership queries.
