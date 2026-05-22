# Cross-Type Relationship Queries

When users ask about fact sheets of one type linked to a specific entity of another type, use a **two-step approach**: find the entity ID first, then filter the target type by that relationship.

## General Pattern

**Step 1 — Find the source entity ID:**

```
search_fact_sheet_by_name(name: "<entity name>", fact_sheet_type: "<SourceType>")
→ ID: "abc-123"
```

**Step 2 — Get linked fact sheets of the target type:**

Use the tool that matches the target type. Pass the source type name as the relation key.

| Target type | Tool to use |
| --- | --- |
| `Application` | `get_applications(application_relations: {"<SourceType>": ["<id>"]})` |
| `Initiative` | `get_initiatives(related_factSheets: {"<SourceType>": ["<id>"]})` |
| Any other type | `text_to_fact_sheets(text: "<natural language query>")` |

**CRITICAL: Always use the FactSheet TYPE NAME as the relation key — NEVER a relation field name** (e.g. not `"relToBusinessCapability"`, not `"relApplicationToProvider"`).

---

## Examples

### "Which apps support the Field Service capability?"

1. `search_fact_sheet_by_name(name: "Field Service", fact_sheet_type: "BusinessCapability")` → get ID
2. `get_applications(application_relations: {"BusinessCapability": ["<id>"]}, page_size: 100)`

### "Which apps are affected by Data Center Migration 2026?"

1. `search_fact_sheet_by_name(name: "Data Center Migration 2026", fact_sheet_type: "Initiative")` → get ID
2. `get_applications(application_relations: {"Initiative": ["<id>"]}, page_size: 100)`

### "Which apps use the Salesforce IT component?"

1. `search_fact_sheet_by_name(name: "Salesforce", fact_sheet_type: "ITComponent")` → get ID
2. `get_applications(application_relations: {"ITComponent": ["<id>"]}, page_size: 100)`

### "Which initiatives involve the Procurement capability?"

1. `search_fact_sheet_by_name(name: "Procurement", fact_sheet_type: "BusinessCapability")` → get ID
2. `get_initiatives(related_factSheets: {"BusinessCapability": ["<id>"]})` → all initiatives linked to that capability

### "Which IT components are used in the Finance domain?"

No dedicated tool for ITComponent as target — use:
`text_to_fact_sheets(text: "IT components used in the Finance domain")`

### "Which interfaces connect to the CRM system?"

1. `search_fact_sheet_by_name(name: "CRM", fact_sheet_type: "Application")` → get ID
2. `text_to_fact_sheets(text: "interfaces connected to <id>")` — or use `get_fact_sheet_details` on the app and inspect its interface relations

---

## Supported Relation Keys for `get_applications`

Multiple UUIDs can be passed per type: `{"BusinessCapability": ["id1", "id2"]}`.

| Key | Finds |
| --- | --- |
| `BusinessCapability` | Apps mapped to the given capability |
| `Initiative` | Apps linked to the given initiative |
| `ITComponent` | Apps using the given IT component |
| `Interface` | Apps connected via the given interface |
| `Provider` | Apps linked to the given provider |
| `Organization` | Apps linked to the given organization |
| `UserGroup` | Apps linked to the given user group |
| `DataObject` | Apps linked to the given data object |
| `Project` | Apps linked to the given project |

Use only type names confirmed in Step 0 (`get_fact_sheet_types`) — not all workspaces have all types.

---

## Combining with Other Filters

Relation filters can be combined with attribute filters on the same tool call:

- Apps in a capability that are end-of-life: `application_relations + lifecycle: ["endOfLife"]`
- Apps in an initiative that are on-premise: `application_relations + lxHostingType: ["onPremise"]`
- Mission-critical apps in a capability: `application_relations + businessCriticality: ["missionCritical"]`

---

## When NOT to Use This Pattern

- If the user asks about the source entity itself (not its linked fact sheets) → use `get_fact_sheet_details`
- If the target type has no dedicated structured tool → use `text_to_fact_sheets` with a natural language description of the relationship
- If the user wants fact sheets by attributes only (no specific related entity) → use `text_to_fact_sheets` or `get_applications` without relations

---

## Reverse Lookups

### Finding initiatives by application

```
get_initiatives(related_factSheets: {"Application": ["<app-id>"]})
→ All initiatives linked to the given application
```

### Finding applications by any related entity

```
get_applications(application_relations: {"<TargetType>": ["<entity-id>"]})
```

### Finding related entities for any fact sheet

```
get_fact_sheet_details(fact_sheet_id: "<id>")
→ Inspect the relations fields in the response for linked fact sheets of any type
```

---

## Initiative Parent/Child (Sub-Projects)

Use `get_initiatives` with `relations` to traverse the initiative hierarchy.

### "What sub-projects exist under X?"

1. `search_fact_sheet_by_name(name: "X", fact_sheet_type: "Initiative")` → get parent ID
2. `get_initiatives(relations: {type: "Parent", ids: ["<parent-id>"]})` → returns child initiatives

### "What is the parent program of initiative X?"

1. `search_fact_sheet_by_name(name: "X", fact_sheet_type: "Initiative")` → get child ID
2. `get_initiatives(relations: {type: "Child", ids: ["<child-id>"]})` → returns parent initiatives
