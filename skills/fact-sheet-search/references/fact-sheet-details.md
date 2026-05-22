# Fact Sheet Details

Use `get_fact_sheet_details` to get full attributes and relations for a single fact sheet.

## Parameters

| Parameter       | Required | Description              |
| --------------- | -------- | ------------------------ |
| `fact_sheet_id` | Yes      | UUID from search results |

**Fields vary by type.** Don't assume fields exist — check response.

## Proven Calls

**Application (ProjectVault):**

- `fact_sheet_id: "d4e5f6a7-b8c9-0123-def0-234567890abc"`
- → Returned: id, displayName, type, status, description, businessCriticality (missionCritical), technicalSuitability (inappropriate), functionalSuitability (unreasonable), lifecycle (phaseIn), tags, completion (50%)

**Initiative (Data Center Migration 2026):**

- `fact_sheet_id: "e5f6a7b8-c9d0-1234-ef01-345678901bcd"`
- → Returned: id, name, type (Initiative), status, description, level (1), category (program), completion (36%), tags

## Response Fields by Type

### Application

- `id`, `name`, `displayName`, `fullName`
- `description`, `type`, `status`
- `lxState` — Quality seal state
- `required_fields_completion` — Completion %
- `businessCriticality`, `technicalSuitability`, `functionalSuitability`
- `lifecycle`, `tags`, `alias`
- `documents`, `subscriptions`
- `relApplicationToBusinessCapability` — With totalCount and edges
- `relApplicationToITComponent` — With totalCount and edges (id, name, type per IT component)
- `createdAt`, `updatedAt`

### Initiative

- `id`, `name`, `displayName`
- `description`, `type`, `status`
- `level`, `category`
- `completion`
- `tags`

## Hierarchy Navigation (Parent/Child)

**Prefer `text_to_fact_sheets` for ALL hierarchy queries** — it traverses the full tree in one call, including all levels, children, and grandchildren. Only use `get_fact_sheet_details` for single-node detail lookups.

| Hierarchy query | Use this |
| --- | --- |
| "All levels of corporate services" | `text_to_fact_sheets(text: "all business capabilities under corporate services including all levels")` |
| "BCs at level 3 without apps" | `text_to_fact_sheets(text: "business capabilities at level 3 without related applications")` |
| "Top-level capabilities" | `text_to_fact_sheets(text: "top level business capabilities level 1")` |
| Direct children of one node | `get_fact_sheet_details` → `relToChild.edges[].node.factSheet` |

**Never call `get_fact_sheet_details` in a loop** to walk a hierarchy — for N levels deep this generates O(N×branching factor) tool calls and will exhaust the context limit. Use `text_to_fact_sheets` instead; it returns all matching nodes in a single paginated response.

## Known Limitations

- Does NOT return `relApplicationToUserGroup`
- Does NOT return `relApplicationToOrganization`
- Field availability varies by fact sheet type
- **Only `fact_sheet_id` is accepted** — do NOT pass `fact_sheet_type` or other extra params (causes empty `{}` response)

## Alternative: Finding Relations via text_to_fact_sheets

`text_to_fact_sheets` can also find related fact sheets:

```
text_to_fact_sheets(text: "find IT Components with relation to application with id d4e5f6a7-...")
```

Use this as an alternative when `get_fact_sheet_details` doesn't return the needed relation type.

## Typical Workflow

Only call `get_fact_sheet_details` when the user explicitly needs full attributes of a specific fact sheet:

1. Find the UUID from search results (`vector_search`, `text_to_fact_sheets`, etc.)
2. Call `get_fact_sheet_details(fact_sheet_id: "<uuid>")` — returns attributes and direct relations

For relation traversal or filtered searches, prefer `text_to_fact_sheets` over `get_fact_sheet_details`.
