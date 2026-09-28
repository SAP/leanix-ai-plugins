# Relation presence and empty values

Load for missing/present relations, intentionally empty relations, scalar/enum field emptiness, and mandatory/data-quality gaps.

**Execution:** direct `mcp__leanix__filter_inventory` is fine for one confirmed missing/present relation or enum value. Use `mcp__leanix__execute_code` for ambiguous software types, multi-type unions, mandatory-field unions, or pagination. For scoped mandatory checks, use one orchestration with multiple narrow missing-facet calls; do not run a broad all-field scan and then retry the same audit with small variations.

Confirm source types, field options, relation facet names, and intentional-empty representation from workspace context/filterOptions.

## Field emptiness

Words like without, no, w/o, empty, or not applicable do not always mean `__missing__`. First discover the field options and copy the empty/not-applicable option key exactly. Technical-fit/suitability fields often use an explicit option such as `n/a`; query that option for "without tech fit" rather than `__missing__`.

For ambiguous "systems/software/tools", include both Applications and ITComponents unless the user names only one type.

## Relation presence

| Intent | Shape |
|---|---|
| Never filled | relation facet with `OR` + `keys:["__missing__"]` |
| Has a relation | relation facet with `NOR` + `keys:["__missing__"]` |
| Explicitly empty / not applicable | confirmed empty sentinel such as `__empty__`, or top-level `naFields:["relX"]` when schema/context exposes it |

Do not infer absence from `NOR` with empty keys. `naFields` is not a facet key or `keys` value; use it only as a top-level filter argument when schema/context confirms that shape.

"Known not used in any process" / "we know are not used" / "empty on purpose" means the confirmed intentional-empty representation for that relation, not `__missing__`. For process usage, inspect the workspace's process/business-context relation options and prefer `keys:["__empty__"]` or `naFields:["relX"]`; `keys:["__missing__"]` means never filled and over-returns. For ambiguous software answers, run Application and ITComponent branches and merge by ID.

## Minimal relation presence shapes

```text
known not used / intentionally empty: facetKey=relX, operator=OR, keys=["__empty__"] or top-level naFields=["relX"]
missing relation: facetKey=relX, operator=OR, keys=["__missing__"]
has relation: facetKey=relX, operator=NOR, keys=["__missing__"]
```

Compact multi-type relation-state shape:

```js
const branches = [
  ["Application", "confirmedApplicationToProcessRelation"],
  ["ITComponent", "confirmedITComponentToProcessRelation"],
];
const byId = new Map();
for (const [type, relation] of branches) {
  const query = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["${type}"]},{facetKey:"${relation}", operator:OR, keys:["__empty__"]}]}){
    totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}} } }`;
  const { items } = await paginate(query, {});
  for (const row of items) byId.set(row.id, row);
}
return { relationState: "intentionally empty", count: byId.size, results: [...byId.values()] };
```

## Mandatory fields and data-quality gaps

For "missing mandatory fields", read mandatory fields, mandatory relations, mandatory subscription roles, and mandatory tag groups from the meta model. Evaluate the union of rows missing any required item; when scoped by geography, build the geography set first and then test mandatory gaps inside that set. Use only fields/relations confirmed by workspace context or filter options: do not invent nested shapes such as `location.country` or `subscriptions.edges.node.role` unless targeted schema/validation confirms them. If a mandatory check needs subscription roles, prefer confirmed subscription facets/roles or the documented subscription filter shape over ad-hoc subscription subfields. If `filterOptions` exposes `DataQuality` sentinels for missing lifecycle/responsible/accountable or quality seal, use those sentinels as fast prefilters/cross-checks, but do not use a broad sentinel when the user asked for one named role.

For large workspaces, avoid one huge all-field/all-relation scan that selects dozens of mandatory fields across thousands of rows. Prefer server-side missing sentinels/facets for each required field or relation and union IDs in `mcp__leanix__execute_code` in chunks. For geography-scoped mandatory questions, resolve the geography Application set once, then run the mandatory gap-union once inside that scoped set. Keep the geography scope as an ID set and intersect every gap branch with it in code; do not first answer a global mandatory audit and then try to retrofit the country/region. If the full mandatory union still exceeds execution limits, return a compact partial with total source count, checked mandatory items, per-gap counts, sample rows, and an explicit `complete:false` limitation instead of retrying the same broad scan. Do not follow a completed scoped mandatory workflow with another broad all-Application audit unless the first call failed with a concrete tool error.

Compact large-workspace shape:

```js
const sourceType = "Application";
const scopedIds = null; // optional: geography/subscription scope IDs; leave null for all source rows
const mandatoryRelations = ["confirmedRelationA", "confirmedRelationB"];
const mandatoryFields = ["confirmedFieldA", "confirmedFieldB"];
const missingById = new Map();
const mark = (row, gap) => {
  const item = missingById.get(row.id) || { factSheetId: row.id, displayName: row.displayName, type: row.type, missing: [] };
  item.missing.push(gap);
  missingById.set(row.id, item);
};
for (const relation of mandatoryRelations) {
  const q = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
    facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["${sourceType}"]},{facetKey:"${relation}", operator:OR, keys:["__missing__"]}]
    ${scopedIds ? `ids:${JSON.stringify(scopedIds)}` : ""}}){totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}}} }`;
  for (const row of (await paginate(q, {})).items) mark(row, relation);
}
// For scalar mandatory fields, first prefer confirmed missing facet keys/options. If no facet exists, page rows with only those scalar fields and stop with complete:false on timeout.
return { complete: true, checked: { mandatoryRelations, mandatoryFields }, count: missingById.size, results: [...missingById.values()] };
```
