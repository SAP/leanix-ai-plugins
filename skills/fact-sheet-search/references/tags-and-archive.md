# Tags and archive

Load for tag/tag-group questions, archived/trash/deleted fact sheets, or feature searches inside the trash bin. Use `lifecycle-state.md` for workflow/quality-seal state.

**Execution:** direct `mcp__leanix__filter_inventory` is fine for one confirmed tag or archive facet and count-only questions. Use `mcp__leanix__execute_code` for ambiguous tag labels, large list-all requests, archived feature searches, or compact inspection of broad `filterOptions`.

## Tags

Use tag UUIDs, not display names:

```text
{ facetKey: "_TAGS_" | "tagGroupUuid", operator: OR, keys: ["tagUuid"] }
```

Confirm the actual tag facet with context or focused `filterOptions`; it is often the tag-group UUID, while ungrouped tags use `_TAGS_`. `filterOptions` may contain non-tag values with the same label as a tag, for example a country or service type named "Global". For "tagged X", prefer exact active tag UUID matches and report ambiguity if several tag groups contain the same label.

## Archived/trash

Archived fact sheets require `TrashBin = archived`; boolean strings are not archive keys. For "archived/trash + feature/name" wording, use `mcp__leanix__execute_code`: paginate archived rows of the requested type with only `TrashBin` and type facets, select narrow evidence fields (`id displayName type description` plus schema-confirmed fields), then post-filter those fields for the requested feature/name in code. Direct text search or `fullTextSearch` inside the archived query can miss archived rows, and first-page inspection can under-return; use text search only as a supplemental branch after the archived-set scan. Return matches under the final key `results`; if no archived evidence matches after the archived-set scan, state the searched archive scope and evidence fields rather than substituting active rows.
