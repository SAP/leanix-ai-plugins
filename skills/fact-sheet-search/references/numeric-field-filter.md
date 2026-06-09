# Numeric Field Filter Subskill

Use this pattern when the query asks to **filter fact sheets by a numeric field value** — e.g. "total cost of ownership greater than 100k", "applications with licensing costs below 50k", "sort by maintenance costs descending".

Numeric fields (type `DOUBLE` or `NUMBER` in `get_meta_model`) have **`inFacet: false`** and therefore cannot be used as `facetFilters`. You must fetch all fact sheets of the relevant type with the field value included in the GraphQL `node` selection, then filter and sort the results yourself.

---

## Step-by-step

### Step 1 — Identify the numeric field

From `get_meta_model` output, find the field key for the concept named in the query:

| Concept | Field key (Application) |
|---|---|
| Total Cost of Ownership | `lxApplicationTotalCostOfOwnership` |
| Licensing Costs | `lxApplicationLicensingCosts` |
| Maintenance Costs | `lxApplicationMaintenanceCosts` |
| Support Costs | `lxApplicationSupportCosts` |

Use the `get_meta_model` response for the actual field key — do not hardcode; custom workspaces may use different names.

### Step 2 — Fetch all fact sheets with the numeric field value

Use `read_inventory` with `first: 500` (or paginate) and request the numeric field via an **inline fragment**:

```graphql
query FactSheetSearch {
  allFactSheets(
    filter: {
      responseOptions: { maxFacetDepth: 5 }
      facetFilters: [{ facetKey: "FactSheetTypes", operator: OR, keys: ["Application"] }]
    }
    first: 500
  ) {
    edges {
      node {
        id
        displayName
        type
        ... on Application {
          lxApplicationTotalCostOfOwnership
        }
      }
    }
    totalCount
    pageInfo { hasNextPage endCursor }
  }
}
```

Replace `lxApplicationTotalCostOfOwnership` with the actual field key. Paginate if `pageInfo.hasNextPage` is true.

### Step 3 — Filter and sort the results

After receiving the response, apply the numeric filter and sort in your reasoning. Follow the logic in the Python reference script below:

```python
# numeric_field_filter.py — reference logic for filtering and sorting
# The agent replicates this logic on the fetched GraphQL results.

def filter_and_sort(edges, field_key, operator, threshold, sort_order="desc"):
    """
    edges       : list of {"node": {"id": ..., "displayName": ..., "<field_key>": value_or_null}}
    field_key   : the numeric field name (e.g. "lxApplicationTotalCostOfOwnership")
    operator    : "gt" | "gte" | "lt" | "lte" | "eq"
    threshold   : numeric value (e.g. 100000)
    sort_order  : "desc" (default, highest first) | "asc" (lowest first)
    """
    ops = {
        "gt":  lambda v: v > threshold,
        "gte": lambda v: v >= threshold,
        "lt":  lambda v: v < threshold,
        "lte": lambda v: v <= threshold,
        "eq":  lambda v: v == threshold,
    }
    predicate = ops[operator]

    matched = []
    for edge in edges:
        node = edge["node"]
        value = node.get(field_key)
        if value is not None and predicate(float(value)):
            matched.append(node)

    matched.sort(
        key=lambda n: float(n.get(field_key) or 0),
        reverse=(sort_order == "desc"),
    )
    return matched
```

**Operator mapping from natural language:**

| Query phrasing | operator |
|---|---|
| "greater than", "more than", "above", "exceeding" | `gt` |
| "at least", "greater than or equal to", "≥" | `gte` |
| "less than", "below", "under", "cheaper than" | `lt` |
| "at most", "less than or equal to", "≤" | `lte` |
| "exactly", "equal to" | `eq` |

**Sort order mapping:**

| Query phrasing | sort_order |
|---|---|
| "highest", "most expensive", "descending", default when asking for "> threshold" | `desc` |
| "lowest", "cheapest", "ascending", "cheapest first" | `asc` |

### Step 4 — Return results

Include only the fact sheets that pass the filter, ordered by the numeric field as determined in Step 3. Return their `id`, `displayName`, and `type` in the structured response.

---

## Example

Query: *"applications that come with a total cost of ownership greater than 100k"*

1. From `get_meta_model`: field key = `lxApplicationTotalCostOfOwnership`, type = `DOUBLE`, `inFacet: false`.
2. Fetch all Applications with `... on Application { lxApplicationTotalCostOfOwnership }`.
3. Filter: keep nodes where `lxApplicationTotalCostOfOwnership > 100000` (null values excluded).
4. Sort: descending by `lxApplicationTotalCostOfOwnership` (highest cost first).
5. Return filtered, sorted list.
