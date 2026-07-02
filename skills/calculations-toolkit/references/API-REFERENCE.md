# LeanIX Calculations API Reference

> **Last Verified**: 2026-01-31 | **Status**: Validated against live API

Reference for creating and managing calculations via MCP tools.

---

> ## ⚠️ WORKSPACE-SPECIFIC NAMES
>
> Field names, relation names, and fact sheet types in this file are **examples from standard configurations**.
>
> **ALWAYS discover actual names** using `mcp__leanix__list_graphql_types` + `mcp__leanix__get_graphql_type_definitions` before creating calculations.

---

## Two Calculation Types

### Fact Sheet Type (`type: "fact-sheet"`)

Targets a field **on the fact sheet itself**.

**Data access:** `data.fieldName` directly

```javascript
// Example: Gartner TIME calculation
export function main() {
  if (data.technicalSuitability == null || data.functionalSuitability == null) {
    return null;
  }
  return calculateTIME(data.technicalSuitability, data.functionalSuitability);
}
```

### Relation Type (`type: "relation"`)

Targets a field **on a relation**.

**Data access:** `data.factSheet.fieldName` (the related fact sheet!)

```javascript
// Example: Copy criticality to relation
export function main() {
  if (!data.factSheet.businessCriticality) {
    return null;
  }
  return data.factSheet.businessCriticality;
}
```

---

## Supported Target Field Types

The MCP tool does not take a field-type parameter — the target field's type is inferred from `affected_field_key` against the workspace data model. This table maps the field's underlying type to the JavaScript value your `main()` should return:

| Target Field Type | JavaScript Return |
|-------------------|-------------------|
| Double | `number` |
| Integer | `number` (whole) |
| String | `string` |
| Single Select | `string` (enum value) |
| Multiple Select | `string[]` |
| External ID | `string` |

### Special Return Values

| Return | Effect |
|--------|--------|
| `null` | Clear the field value |
| `undefined` | No change (typically indicates bug) |

---

## Fact Sheet Types

Standard fact sheet types for the `affected_fact_sheet_type` field:

| Type | API Value |
|------|-----------|
| Application | `Application` |
| IT Component | `ITComponent` |
| Business Capability | `BusinessCapability` |
| Process | `Process` |
| Data Object | `DataObject` |
| Interface | `Interface` |
| User Group | `UserGroup` |
| Project | `Project` |
| Provider | `Provider` |
| Technical Stack | `TechnicalStack` |
| Initiative | `Initiative` |
| Objective | `Objective` |

Note: Custom fact sheet types use their configured type name.

---

## Data Access Patterns

### Fact Sheet Calculations (`type: "fact-sheet"`)

```javascript
data.name                        // Fact sheet name
data.description                 // Description
data.businessCriticality         // Custom field
data.lifecycle.currentPhase      // Current phase
```

### Relation Calculations (`type: "relation"`)

```javascript
data.factSheet.name              // Related fact sheet's name
data.factSheet.description       // Related fact sheet's description
data.factSheet.lifecycle.currentPhase  // Related fact sheet's lifecycle
```

### Relations in Fact Sheet Calculations

Relations return arrays directly (no GraphQL needed):

```javascript
// Get relation array
const relations = data.relApplicationToITComponent ?? [];

// Count relations
relations.length

// Access related fact sheet
relations[0].factsheet

// Access field on related fact sheet
relations[0].factsheet.name
relations[0].factsheet.lifecycle.currentPhase

// Access relation attribute
relations[0].usageType
relations[0].obsolescenceRiskStatus
```

### Discovering Relation Names

> **⚠️ Do NOT assume these relation names exist in your workspace.**
>
> Relation names vary by workspace configuration. Always discover them first.

**Discover relations via MCP:**

```
Step 1: mcp__leanix__list_graphql_types(filter="Application")
        → finds "Application", "ApplicationToBusinessCapabilityRelation", etc.

Step 2: mcp__leanix__get_graphql_type_definitions(["Application", "ApplicationToBusinessCapabilityRelation"])
        → returns SDL with all fields, relations, and enum values
```

Inspect the returned relation keys (e.g. `relApplicationToITComponent`) — these are the valid names for `data.relName` in your code.

**Standard naming pattern (if using standard configuration):**
```
rel{SourceType}To{TargetType}
```

Example: `relApplicationToITComponent`

But custom workspaces may use different patterns!

---

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid field: affected_field_key 'invalidField' not found",
  "status": 400
}
```

#### 409 Conflict
```json
{
  "error": "Conflict",
  "message": "A calculation already exists for field 'itcCount' on Application",
  "status": 409
}
```

### Configuration Errors

When `invalid: true` or errors exist:

| Error | Cause | Fix |
|-------|-------|-----|
| "Circular dependency detected" | Reading target field as source | Don't access `data.{affected_field_key}` |
| "Target attribute not found" | Field doesn't exist | Check field name and fact sheet type |
| "Target attribute is read-only" | Base field selected | Choose a custom field |
| "Syntax error in code" | Invalid JavaScript | Fix syntax errors |

### Error Counts

- `errorCount` - Number of runtime errors when executing on fact sheets
- `configurationErrorCount` - Number of configuration errors (bad field names, etc.)

---

## Complete Creation Example

> **All CRUD operations go through MCP tools.**

### Create via MCP Tool

```
Tool: mcp__leanix__create_calculation
Parameters:
  name: "Count IT Components"
  description: "Counts linked IT components"
  type: "fact-sheet"
  affected_fact_sheet_type: "Application"
  affected_field_key: "itcCount"
  code: "export function main() { return data.relApplicationToITComponent?.length ?? 0; }"
  status: "inactive"
  owner_id: "{USER_UUID}"
```

### List via MCP Tool

```
Tool: mcp__leanix__list_calculations
```

### Update via MCP Tool

```
Tool: mcp__leanix__update_calculation
Parameters:
  id: "{UUID}"
  name: "Updated Name"
  code: "..."
```

### Test-Run via MCP Tool (before creating)

```
Tool: mcp__leanix__test_run_calculation
Parameters:
  type: "fact-sheet"
  affected_fact_sheet_type: "Application"
  affected_fact_sheet_id: "{REAL_UUID}"   # must be a real fact sheet
  affected_field_key: "itcCount"
  code: "export function main() { return data.relApplicationToITComponent?.length ?? 0; }"
```

For relation calculations, use fact sheet ID pairs instead of a relation instance UUID:

```
Tool: mcp__leanix__test_run_calculation
Parameters:
  type: "relation"
  affected_relation_name: "relApplicationToBusinessCapability"
  affected_from_fact_sheet_id: "{SOURCE_UUID}"
  affected_to_fact_sheet_id: "{TARGET_UUID}"
  affected_field_key: "supportType"
  code: "export function main() { return data.factSheet.businessCriticality; }"
```

**Returns:** `{ success: bool, result: <computed value>, executorInput: <data object seen by code> }`

Use this to validate code and confirm `affected_field_key` exists before calling `create_calculation`.

---

### Enable / Disable via MCP Tool

```
Tool: mcp__leanix__enable_calculation
Parameters:
  id: "{UUID}"

Tool: mcp__leanix__disable_calculation
Parameters:
  id: "{UUID}"
```

### Delete via MCP Tool

```
Tool: mcp__leanix__delete_calculation
Parameters:
  id: "{UUID}"
```

**Response:** Returns only the deleted calculation's ID — `{ "id": "{UUID}" }`. The full calculation object is **not** returned. The deletion is irreversible; use `disable_calculation` instead if you need to stop a calculation from running while preserving it.

---

## UI URL Format

After creating a calculation, provide the edit URL:

```
https://{INSTANCE}.leanix.net/{WORKSPACE}/admin/calculations/{ID}
```

Components:
- `{INSTANCE}` - LeanIX instance (e.g., `demo-eu-8`)
- `{WORKSPACE}` - Workspace name from JWT payload
- `{ID}` - Calculation UUID

---

## Execution Logs

Execution logs record every time a calculation runs — including the code that executed, the context data it received, the value it wrote, and the outcome.

### `list_execution_logs`

Lists calculation execution log entries, most recent first. Supports cursor-based pagination (`page_size`, `cursor` → `nextCursor`).

| Parameter | Type | Description |
|-----------|------|-------------|
| `calculation_id` | UUID[] (optional) | Filter to one or more calculations |
| `fact_sheet_id` | UUID[] (optional) | Filter to one or more affected fact sheets (matches either side of a relation) |
| `status` | string[] (optional) | Any of: `"value-changed"`, `"no-change"`, `"field-cleared"`, `"failed"` |
| `trigger` | string[] (optional) | Any of: `"fact-sheet-update"`, `"calculation-update"`, `"scheduled-update"`, `"meta-model-change"` |
| `date_from` | ISO 8601 string (optional) | Only logs finished at or after this timestamp |
| `date_to` | ISO 8601 string (optional) | Only logs finished at or before this timestamp |

**Returns:** Array of log entries. Key fields per entry:

| Field | Description |
|-------|-------------|
| `id` | Log entry UUID |
| `calculationId` | The calculation that ran |
| `calculationName` | Name of the calculation at run time |
| `factSheetId` | UUID of the affected fact sheet |
| `factSheetName` | Name of the affected fact sheet |
| `status` | `"value-changed"`, `"no-change"`, `"field-cleared"`, or `"failed"` |
| `trigger` | What triggered the run |
| `startedAt` / `finishedAt` | Run timestamps |
| `output` | Value written, or null if field was cleared or no value produced |
| `triggerFieldKey` | Input field whose change triggered the run |
| `triggerNewValue` | New value of the triggering field |

### `get_execution_log`

Retrieves the full detail of a single execution log entry, including the code and context data that ran.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID (required) | Log entry ID from `list_execution_logs` |

**Returns:** All list fields plus:

| Field | Description |
|-------|-------------|
| `previousValue` | Field value before this run (null if none) |
| `input.code` | The exact JavaScript source code that executed |
| `input.contextData` | The `data` object the code received |
| `codeVersionStatus` | `"current"` if still the latest code, `"older"` if superseded |

### Typical Use Cases

| Goal | Call |
|------|------|
| Find recent failures | `list_execution_logs(calculation_id=[...], status=["failed"])` |
| Inspect a specific run | `get_execution_log(id)` |
| Audit what ran on a fact sheet | `list_execution_logs(fact_sheet_id=[...])` |
| Filter by time window | `list_execution_logs(date_from=..., date_to=...)` |
| Understand trigger history | `list_execution_logs(calculation_id=[...])` → inspect `trigger` field |
