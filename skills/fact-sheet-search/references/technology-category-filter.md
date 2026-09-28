# Technology class under a category

Load when a technology class must also belong to a named taxonomy/category, for example "a class under a named business/technology category".

**Execution:** use `mcp__leanix__execute_code`; resolve category UUIDs, fetch related technologies/components, then apply class filtering/deduping in code.

This is an intersection, not broad semantic search. Use `mcp__leanix__search_inventory` only to discover candidate wording if needed; never return a semantic top hit as the answer without proving the category relation.

Workflow:

1. Infer the requested answer type; technology classes commonly mean `ITComponent`.
2. Confirm the configured category/taxonomy type and answer-type-to-category relation. If the initial context omitted the taxonomy type, the initial context should be widened next run; do not guess the relation key.
3. Resolve the named category to UUIDs. If text search returns no exact category, paginate the taxonomy type and match leaf/path segments; category labels are often hierarchy paths rather than standalone names.
4. Fetch answer rows related to those category UUIDs.
5. Filter those rows for the requested technology class using direct evidence in name, alias, description, product/category fields, or confirmed class fields. For acronyms/classes, require class evidence on the technology row; do not substitute a neighbouring semantic product.

Replace standard names such as `ITComponent`, `TechnicalStack`, and `relITComponentToTechnologyStack` with values confirmed by workspace context.

## Minimal category intersection shape

```text
categoryIds = taxonomy/category rows whose leaf/path matches the named category
candidates = ITComponents related to categoryIds through the confirmed category relation
results = candidates whose name/alias/description/product fields prove the requested class
```

Compact category-intersection shape:

```js
const categoryName = "Named category";
const classPattern = /requested class phrase|\bACRONYM\b/i;
const categoryQ = `query($after:String, $q:String!){ allFactSheets(first:50, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["TechnicalStack"]}], fullTextSearch:$q}){
  totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type}} } }`;
const { items: categories } = await paginate(categoryQ, { q: categoryName }, { maxPages: 1 });
const leaf = (name) => (name || "").split("/").pop().trim().toLowerCase();
const category = categories.find((row) => leaf(row.displayName) === categoryName.toLowerCase()) || categories[0];
if (!category?.id) return { categoryResolved: false, results: [] };
const query = `query($after:String){ allFactSheets(first:200, after:$after, filter:{responseOptions:{maxFacetDepth:5}
  facetFilters:[{facetKey:"FactSheetTypes", operator:OR, keys:["ITComponent"]},{facetKey:"relITComponentToTechnologyStack", operator:OR, keys:["${category.id}"]}]}){
  totalCount pageInfo{hasNextPage endCursor} edges{node{id displayName type description}} } }`;
const { items, complete } = await paginate(query, {});
const results = items.filter((row) => classPattern.test(`${row.displayName || ""} ${row.description || ""}`));
return { category: category.displayName, count: results.length, complete, results };
```
