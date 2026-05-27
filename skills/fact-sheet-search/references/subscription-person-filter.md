# Subscription Person Filter Examples

Filtering fact sheets by a **named subscriber/owner/responsible** requires a two-step approach:

1. Call `search_users` to resolve the person's display name to a UUID.
2. Use that UUID as a key in the `Subscriptions` facet filter.

---

## Step 1 — Resolve person name to userId

```
search_users(query="Frank Martin")
```

From the response, take the **`userId` field** (not the `id` field — they are different).

If multiple users match, pick the closest full-name match. If 0 results, report "Person not found."

---

## Step 2 — Filter by userId + subscription role

### Named person as RESPONSIBLE

```graphql
# "Which applications have Frank Martin as responsible?"
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "Subscriptions"
          operator: OR
          keys: ["<userId>"]
          subscriptionFilter: { type: "RESPONSIBLE" }
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

### Named person as OBSERVER

```graphql
# "Which applications is Kent Eisenberg observing?"
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "Subscriptions"
          operator: OR
          keys: ["<userId>"]
          subscriptionFilter: { type: "OBSERVER" }
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

### Named person as any subscriber (no role specified)

When the query just says "subscribed to" without a role, omit `subscriptionFilter`:

```graphql
# "Which applications is Anne-Lise Cornella subscribed to?"
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [
        { facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }
        {
          facetKey: "Subscriptions"
          operator: OR
          keys: ["<userId>"]
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

## Role vocabulary mapping

| User says | `subscriptionFilter.type` |
|---|---|
| responsible, owner, accountable owner | `"RESPONSIBLE"` |
| accountable | `"ACCOUNTABLE"` |
| observer, watcher | `"OBSERVER"` |
| subscribed to (no role) | omit `subscriptionFilter` |

---

## No specific person — use `__missing__` / `NOR`

```graphql
# "Applications missing a responsible":
{ facetKey: "Subscriptions", operator: OR, keys: ["__missing__"], subscriptionFilter: { type: "RESPONSIBLE" } }

# "Applications that have a responsible":
{ facetKey: "Subscriptions", operator: NOR, keys: ["__missing__"], subscriptionFilter: { type: "RESPONSIBLE" } }

# "Applications with no subscribers at all":
{ facetKey: "Subscriptions", operator: OR, keys: ["__missing__"] }
```

Do **not** call `search_users` for these — they have no named person.
