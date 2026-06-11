---
name: calculations-toolkit
description: Build, debug, and create LeanIX Calculations — populate computed fields from other fields and relations. Use when creating new calculations, debugging errors, understanding calculation capabilities, managing workspace calculations, or analyzing existing calculations. Covers target field types, field access patterns, relation data, templates, error patterns, and best practices.
license: Apache-2.0
compatibility: Requires LeanIX MCP server for API access (mcp__leanix__* tools)
metadata:
  author: SAP LeanIX
  version: "1.0"
allowed-tools:
  - Read
  - Write
  - Edit
  - AskUserQuestion
  - mcp__leanix__list_calculations
  - mcp__leanix__get_calculation
  - mcp__leanix__create_calculation
  - mcp__leanix__update_calculation
  - mcp__leanix__enable_calculation
  - mcp__leanix__disable_calculation
  - mcp__leanix__delete_calculation
  - mcp__leanix__test_run_calculation
  - mcp__leanix__list_graphql_types
  - mcp__leanix__get_graphql_type_definitions
  - mcp__leanix__get_fact_sheet_types
  - mcp__leanix__get_fact_sheet_details
  - mcp__leanix__text_to_fact_sheets
  - mcp__leanix__search_users
---

# LeanIX Calculation Assistant

Comprehensive help for LeanIX Calculations: create, debug, design, and manage.

## CRITICAL: API Access

**All LeanIX API calls use MCP tools.** No shell commands, no token exchange, no curl.

- **Authentication** is handled internally by the MCP server
- **No bearer tokens** need to be managed in the skill workflow
- **No `.mcp.json` parsing** is required — MCP handles credentials automatically

---

> ## ⚠️ WORKSPACE-SPECIFIC DATA MODEL
>
> **Do NOT assume standard fact sheet types, fields, or relations exist.**
>
> Every LeanIX workspace has custom configurations. Before creating or debugging calculations:
>
> 1. **Fact sheet types** are enumerated in the `create_calculation` tool schema — no discovery call needed
> 2. **Fetch SDL** using `mcp__leanix__list_graphql_types` + `mcp__leanix__get_graphql_type_definitions` for fields, relations, and enums
> 3. **Present discovered options** to the user (not hardcoded lists)
> 4. **Validate all names** exist before generating code
>
> Reference files in this skill contain **static examples only**. Always use live workspace data.

## CRITICAL: Calculations vs Automations

Calculations are fundamentally different from Automations:

| Aspect | Calculations | Automations |
|--------|-------------|-------------|
| **Purpose** | Populate computed fields | React to events with actions |
| **Trigger** | Auto-triggers on source field change | 12 explicit trigger types |
| **API calls** | **NOT allowed** | Allowed (`fetch`, GraphQL) |
| **Async** | **NOT supported** | Supported |
| **Output** | Single value (string/number/array) | Object with field names |
| **Creation** | Single API call | Two calls (script + template) |

### Two Calculation Types

| Type | Use Case |
|------|----------|
| `fact-sheet` | Compute a field value on a fact sheet using its own data |
| `relation` | Compute a field value on a relation (the edge between two fact sheets) using data from either side |

---

## Anti-Patterns (Don't Do This)

| Pattern | Why It Fails                                                |
|---------|-------------------------------------------------------------|
| `async function main()` | Async not supported                                         |
| `await fetch(...)` | No API calls allowed                                        |
| `import` statements | No imports allowed                                          |
| `return { field: value }` | Must return single value                                    |
| `data.factSheet.field` in fact-sheet calc | Use `data.field` directly                                   |
| `data.field` in relation calc | Use `data.factSheet.field`                                  |
| Reading target field | Circular dependency error                                   |
| Using `principal.id` from technical user token as `owner_id` | Always use a real human user's `userId` from `search_users` |

---

## Greeting

When this skill is invoked, display this welcome message:

---

**SAP LeanIX Calculation Assistant**

Welcome! I help you build, debug, manage, and create LeanIX Calculations—computed fields that automatically populate from other fields and relations.

---

## Reference Files (Progressive Disclosure)

Load these files **only when needed** for specific workflow steps:

| File | Load When | Contains |
|------|-----------|----------|
| `references/API-REFERENCE.md` | Creating calculations (Step 6) | API endpoints, CalculationDto |
| `references/TEMPLATES.md` | Generating code (Step 5) | Ready-to-use calculation templates |
| `references/LEANIX-MODEL.md` | Understanding field types | Fact sheet types, relations, field access |
| `references/NAMING-CONVENTION.md` | Standardizing names | Naming convention |
| `references/ANALYSIS-RULES.md` | Analyzing calculations | Code analysis rules, workspace checks |

---

## Workflow

### Step 0: Determine Intent

**First, check if the user's message already expresses clear intent.** If it does, skip `AskUserQuestion` and branch directly:

| If the user's message contains… | Branch to |
|----------------------------------|-----------|
| "what can", "what does", "capabilities", "help me", "do for me" | [Understand Capabilities] |
| "create", "build", "new calculation", "add a calculation" | [Create New Calculation] |
| "debug", "fix", "error", "not working", "broken" | [Debug Failing Calculation] |
| "list", "manage", "show", "audit", "analyze", "existing" | [Manage Workspace Calculations] |

**Only ask if intent is genuinely ambiguous.** Use `AskUserQuestion`:

**IMPORTANT: `AskUserQuestion` supports 2–4 options only.** When there are more than 4 choices, list all options as a numbered list in plain text and ask the user to type their selection instead.

**What do you need help with?**

| Option | Description |
|--------|-------------|
| **Create new calculation** | Build a new calculated field |
| **Debug failing calculation** | Diagnose and fix a calculation that's not working |
| **Understand capabilities** | Learn what calculations can do |
| **Manage workspace calculations** | Query, analyze, fix, or reorganize existing calculations |

Branch to the appropriate workflow based on response.

---

### Step 0.1: Verify Calculations Toolset

**Run immediately after determining intent (before any other MCP call):**

Call `mcp__leanix__list_calculations()`. This is a lightweight check that confirms the `calculations` toolset is active.

**If the call succeeds:** Continue to the next step silently (no message needed).

**If the tool is not found / not available:**

The `calculations` toolset is **optional and hidden by default**. Display this message to the user:

> **Calculation tools are not available.** Your MCP connection is missing the `calculations` toolset.
>
> Fix: Add `?toolsets=inventory,calculations,custom_reports` to your MCP server URL.
>
> **Claude Code (OAuth):**
> ```
> claude mcp remove leanix
> claude mcp add --transport http leanix "https://mcp.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory,calculations,custom_reports"
> ```
>
> **Claude Code (.mcp.json):** Change the URL to:
> ```
> https://{SUBDOMAIN}.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory,calculations
> ```
>
> After updating, restart Claude Code and re-invoke the `calculations-toolkit` skill.

Then **stop the workflow** — do not continue without calculation tools, as creation will fail.

**If MCP is not connected at all** (no `mcp__leanix__*` tools available):

> **No LeanIX MCP connection detected.** This skill requires the LeanIX MCP server.
>
> Quickest setup:
> ```
> claude mcp add --transport http leanix "https://mcp.leanix.net/services/mcp-server/v1/mcp?toolsets=inventory,calculations,custom_reports"
> ```
>
> See [MCP Setup](../../MCP-SETUP.md) for full instructions.

---

## [Create New Calculation] Workflow

### Step 1: Workspace Context (Automatic)

MCP handles authentication and workspace connection automatically. No credential extraction or token exchange needed.

**Verify connection:**
1. Call `mcp__leanix__list_calculations()` to confirm workspace access (already done in Step 0.1).

**Display:** `Connected to LeanIX workspace - Ready to create calculations.`

**Fallback:** If MCP not configured, offer to set up MCP.

---

### Step 1.5: Discover Workspace Data Model

> **CRITICAL:** Do NOT assume standard fact sheet types, fields, or relations exist.
> Every workspace has custom configurations. ALWAYS discover before proceeding.

**Fact sheet types** are enumerated in the `create_calculation` tool schema — no discovery call needed.

**Discover field keys, relation names, and enum values** using the GraphQL SDL:

```
Step 1: mcp__leanix__list_graphql_types(filter="{FactSheetType}")
        → finds type names e.g. "Application", "ApplicationToBusinessCapabilityRelation"

Step 2: mcp__leanix__get_graphql_type_definitions(["Application", "ApplicationToBusinessCapabilityRelation"])
        → returns SDL with all fields, relations, and enum values
```

The SDL response gives you:
- All fields with their types (e.g., `functionalSuitability: ApplicationFunctionalSuitability`)
- All relations and what they connect (e.g., `relApplicationToBusinessCapability: ApplicationToBusinessCapabilityRelationConnection`)
- All enum values for Single Select fields

**Extract and store from the SDL:**

| Data | Use |
|------|-----|
| Field names and types | Present as target field options in Step 2 |
| Relation names | Present as source data options in Step 3 |
| Enum values | Validate return type for Single Select targets |

**Display to user:**

```
Found fact sheet types in your workspace.
Which fact sheet type should this calculation target?
```

**Why this step is mandatory:**
- Workspaces have custom fields beyond the standard set
- Relation names depend on how the workspace was configured
- Enum options for Single Select fields are workspace-specific
- Using wrong names causes `configurationErrorCount` errors

**Store the data model** for use in subsequent steps - do not re-query.

---

### Step 2: Identify Target Field

> **Use data model from Step 1.5** - Do not ask for free-text field names.

**Present fact sheet types from data model:**

> **IMPORTANT: `AskUserQuestion` supports 2–4 options only.** When there are more than 4 choices (e.g., fact sheet types), do NOT use `AskUserQuestion`. Instead, list all options as a numbered list in plain text and ask the user to type their choice. Wait for the user's text reply before proceeding.

**After user selects fact sheet type, present fields from data model:**

```
Tool: AskUserQuestion

"Which field should this calculation populate?"

Options: [Custom fields from data model for selected type]
         [Show field types: Double, Integer, String, Single Select, etc.]
```

> **If the target field doesn't exist yet:** The field must be created in the LeanIX UI before a calculation can populate it.
>
> **How to create a custom field:**
> 1. Go to the fact sheet configuration page and select the subsection where you want the field
> 2. Click **Add field**
> 3. Configure the field parameters in the right-side panel
> 4. Review and save the changes
>
> Full documentation: [Fact Sheet Fields – SAP Help](https://help.sap.com/docs/leanix/ea/fact-sheet-fields?q=create+custom+field)

**Ask calculation type:**

```
Tool: AskUserQuestion

"Where is the target field located?"

Options:
- "On the fact sheet itself" → type: fact-sheet
- "On a relation" → type: relation
```

**For relation type calculations:**
- Present relations from data model (not hardcoded list)
- Note that data access will be `data.factSheet.fieldName`

**Important constraints:**
- Base fields (built-in) cannot be targets
- Each field can only have ONE calculation
- Cannot read target field as source (prevents loops)

### Step 3: Identify Source Data

> **Use data model from Step 1.5** - Present actual fields and relations from the workspace.

**Present source options based on calculation type:**

For **fact-sheet** calculations, present:
1. **Fields on the fact sheet** - From data model for selected type
2. **Relations** - From data model, show relation names
3. **Lifecycle** - `data.lifecycle.currentPhase`

For **relation** calculations, present:
1. **Fields on related fact sheet** - `data.factSheet.fieldName`
2. **Lifecycle of related fact sheet** - `data.factSheet.lifecycle.currentPhase`

**Data Access Reference:**

| Source Type                           | Fact-Sheet Calc | Relation Calc |
|---------------------------------------|-----------------|---------------|
| **Same fact sheet field**             | `data.fieldName` | N/A |
| **Related fact sheet field**          | N/A | `data.factSheet.fieldName` |
| **Lifecycle**                         | `data.lifecycle.currentPhase` | `data.factSheet.lifecycle.currentPhase` |
| **Relations**                         | `data.{relationName}` | N/A |
| **Related FS field via relation**     | `data.{relationName}[i].factsheet.{field}` | N/A |
| **Relation attribute**                | `data.{relationName}[i].{attributeName}` | N/A |
| **NA fields** (not applicable fields) | `data.naFields` — `string[]` of field keys | `data.factSheet.naFields` |

> **Note:** Replace `{relationName}`, `{field}`, `{attributeName}` with actual names from data model.

**Key insight:** Relations return arrays directly!

---

### Step 3.5: Validate Configuration

> **Before generating code**, verify all names exist in the data model.

**Validation Checklist:**

| Check | How | Error If Failed |
|-------|-----|-----------------|
| Target field exists | Look up in data model | `affected_field_key not found` |
| Target field is writable | Not a base field | `Target attribute is read-only` |
| Target field type known | From data model | Wrong return type |
| **If target is Single/Multi Select: fetch enum values** | `get_graphql_type_definitions(["{EnumTypeName}"])` — enum type name is the field's GraphQL type from SDL | Returning an invalid enum string silently clears the field — no error thrown |
| Source fields exist | Look up in data model | `configurationErrorCount` errors |
| Relations exist | Look up in data model | `undefined` at runtime |

**Display configuration summary:**

```
Configuration Summary:
- Fact Sheet Type: {type} ✓ (exists in workspace)
- Target Field: {field} ✓ (type: {fieldType})
- Source Data: {sources} ✓ (validated)
- Calculation Type: {fact-sheet|relation}

Proceed with code generation?
```

**If validation fails:**
- Show which names are incorrect
- Suggest closest matches from data model
- Do NOT proceed until corrected

---

### Step 4: Define Calculation Logic

Based on the goal, determine the calculation pattern:

| Goal | Pattern | Template |
|------|---------|----------|
| Count relations | `data.rel.length` | Template 1 |
| Sum numeric field | `reduce((a,b) => a+b, 0)` | Template 2 |
| Average | Sum / length | Template 3 |
| Min/Max | `Math.min/max(...values)` | Template 4 |
| Derive status | Map value to enum | Template 5-7 |
| Days until date | Date difference | Template 8 |
| Concatenate strings | Template literals | Template 9 |
| Collect unique values | `new Set()` | Template 10 |
| Conditional | If-then-else | Template 11 |
| Scoring | Weighted calculation | Template 12 |
| Completeness | Check required fields | Template 13 |
| Default values | Null coalescing | Template 14 |

→ **For templates:** Load `references/TEMPLATES.md`

### Step 5: Generate Calculation Code

**Critical Rules Checklist:**
- [ ] NO imports - only `data` available
- [ ] NO `async/await` - must be synchronous
- [ ] NO `fetch()` - no API calls allowed
- [ ] MUST read at least one `data.*` field (API rejects otherwise)
- [ ] Use `export function main()` (never async)
- [ ] Return single value matching target field type
- [ ] Return `null` to clear field, `undefined` for no change
- [ ] Add inline comments explaining non-obvious logic (e.g. why a fallback value is used, what a condition guards against)

**Fact Sheet Calculation Template:**
```javascript
/**
 * [CALCULATION NAME]
 * Type: fact-sheet
 * Fact Sheet: [TYPE]
 * Target Field: [FIELD] ([TYPE])
 * Logic: [DESCRIPTION]
 */

export function main() {
  // Guard: return null to clear the field if required source data is missing
  if (!data.someRequiredField) return null;

  // [Explain non-obvious logic, e.g. why a fallback value is used]
  const value = data.someField ?? 0;

  // [Explain what this condition guards against]
  if (data.someRelation.length === 0) return null;

  return value;
}
```

**Relation Calculation Template:**
```javascript
/**
 * [CALCULATION NAME]
 * Type: relation
 * Fact Sheet: [TYPE]
 * Relation: [RELATION_NAME]
 * Target Field: [FIELD] ([TYPE])
 * Logic: [DESCRIPTION]
 */

export function main() {
  // Guard: no value to compute if source field is unset on the related fact sheet
  const sourceValue = data.factSheet.someField;
  if (sourceValue == null) return null;

  // [Explain distribution logic, weighting, or other non-obvious computation]
  const count = data.factSheet.someRelation.length;

  // Avoid division by zero when no related items exist
  if (count === 0) return null;

  return sourceValue / count;
}
```

### Step 5.5: Test Run

> **RECOMMENDED:** Test calculation code against real data before creating it.

The test-run executes your code in a sandbox against a real fact sheet without creating or modifying any calculation. Use it to:
- **Validate logic** - Confirm the code returns expected values
- **Test edge cases** - Verify null/empty handling across different fact sheets

**For fact-sheet calculations:**

1. Find a sample fact sheet to test against:
   ```
   Tool: mcp__leanix__text_to_fact_sheets
   Parameters: { "text": "{FactSheetType} fact sheets" }
   ```

2. Run the test:
   ```
   Tool: mcp__leanix__test_run_calculation
   Parameters:
     type: "fact-sheet"
     code: "export function main() { ... }"
     affected_field_key: "targetFieldName"
     affected_fact_sheet_type: "Application"
     affected_fact_sheet_id: "{UUID from step 1}"
   ```

**For relation calculations:**

A relation calculation runs against a specific edge between two fact sheets. Identify the edge by passing the **source** and **target** fact sheet UUIDs along with the relation name — the MCP server resolves the underlying relation instance automatically.

1. Find a sample source fact sheet:
   ```
   Tool: mcp__leanix__text_to_fact_sheets
   Parameters: { "text": "{FactSheetType} fact sheets" }
   ```

2. Inspect its relations to pick a target fact sheet on the other side of the edge:
   ```
   Tool: mcp__leanix__get_fact_sheet_details
   Parameters: { "fact_sheet_ids": ["{sourceUUID}"], "fact_sheet_type": "Application" }
   ```
   In the response, look at `<relationName>.edges[*].node.factSheet.id` — pick one of those as your target UUID.

3. Run the test:
   ```
   Tool: mcp__leanix__test_run_calculation
   Parameters:
     type: "relation"
     code: "export function main() { ... }"
     affected_field_key: "targetFieldName"
     affected_relation_name: "relApplicationToBusinessCapability"
     affected_from_fact_sheet_id: "{sourceUUID}"
     affected_to_fact_sheet_id: "{targetUUID}"
   ```

> **Alternative:** If you already have a relation instance UUID (e.g., from the LeanIX UI), pass it as `affected_relation_id` instead of the from/to pair.

**Interpreting results:**

| Field | Meaning |
|-------|---------|
| `success: true` | Code ran and result is valid for the target field |
| `success: false` | Code ran but result is invalid (wrong type, etc.) |
| `result` | The actual return value from the code |
| `data` | The executor input — inspect to understand what `data.*` contains |

**Debugging tips:**
- Inspect `executorInput.data` in the test-run response to see available fields
- Test with fact sheets that have different data (empty relations, missing fields)
- If `success: false`, check that return type matches target field type

**Proceed to creation only when:**
- [ ] Test returns `success: true`
- [ ] Result value is the expected value
- [ ] No unexpected `null`/`undefined` returns on edge-case fact sheets

---

### Step 5.7: Select Calculation Owner

Every calculation requires an `owner_id` — the LeanIX user who owns the calculation in the workspace. **The owner must be a real human user**, not a technical user.

**Ask the user using `AskUserQuestion`:**

> "Who should own this calculation?"

| Option | Description |
|--------|-------------|
| **Assign me as owner** | Look up the current user's email and use their `userId` |
| **Search for another user** | Look up a different user by name or email |

**If the user picks "Assign me as owner":**
- Ask for their email if not already known
- Run `mcp__leanix__search_users(email="...")`
- Use the `userId` field (NOT `id`) from the result as `owner_id`

**If the user picks "Search for another user":**
- Ask: "What's the user's name or email?"
- Run `mcp__leanix__search_users(query="...")` (or `email="..."`)
- If multiple matches, present them via `AskUserQuestion` and let the user pick
- Use the `userId` field (NOT `id`) from the chosen result as `owner_id`

> **Validation:** Verify `displayName` resolves to a real human (not blank, "? ?", or "null null"). If it doesn't, the result is likely a technical user — search again.

---

### Step 5.8: Confirm Before Creating

Present the final calculation to the user before creating it:

```
**Calculation ready to create:**

- **Name:** {name}
- **Type:** {fact-sheet | relation}
- **Fact Sheet Type:** {type}
- **Target Field:** {affectedFieldKey}
- **Owner:** {displayName}

**Code:**
```javascript
{code}
```
```

Then ask using `AskUserQuestion`:

**"Create this calculation?"**

| Option | Description |
|--------|-------------|
| **Create** | Proceed with creation |
| **Edit code** | Go back and modify the code |
| **Cancel** | Abort |

Only proceed to Step 6 if the user confirms.

---

### Step 6: Create Calculation

Use the MCP tool to create the calculation. The `owner_id` was selected in Step 5.7.

**Fact-sheet calculation:**
```
Tool: mcp__leanix__create_calculation
Parameters:
  name: "Calculation Name"
  description: "What it calculates"
  type: "fact-sheet"
  affected_fact_sheet_type: "Application"
  affected_field_key: "fieldName"
  code: "export function main() { ... }"
  status: "inactive"
  owner_id: "{USER_UUID from Step 5.7}"
```

**Relation calculation:**
```
Tool: mcp__leanix__create_calculation
Parameters:
  name: "Calculation Name"
  description: "What it calculates"
  type: "relation"
  affected_fact_sheet_type: "Application"
  affected_relation_name: "relApplicationToBusinessContext"
  affected_field_key: "fieldName"
  code: "export function main() { ... }"
  status: "inactive"
  owner_id: "{USER_UUID from Step 5.7}"
```

**Success:** Report the calculation ID and URL: `https://{INSTANCE}.leanix.net/{WORKSPACE}/admin/calculations/{id}`

> **Deriving INSTANCE and WORKSPACE:** If unknown, call `mcp__leanix__text_to_fact_sheets` with any query (e.g. `"Application"`) and extract the base URL from any fact sheet's `url` field — it will be in the form `https://{INSTANCE}.leanix.net/{WORKSPACE}/...`. All calculation URLs share the same base; only the `{id}` segment changes per calculation.

→ **For creation details:** Load `references/API-REFERENCE.md`

### Step 7: Enable Calculation

> **Rule:** Source fields (data.*) are extracted from the calculation code **only when it is enabled**, not when saved as inactive.

Ask the user using `AskUserQuestion`:

**"The calculation was created as inactive. Enable it now?"**

| Option | Description |
|--------|-------------|
| **Enable now** | Activate the calculation so it starts computing values |
| **Keep inactive** | Leave it inactive for manual review first |

If the user chooses **Enable now**, call:
```
Tool: mcp__leanix__enable_calculation
Parameters: { "id": "{calculation UUID from Step 6}" }
```

### Step 6.5: Verify Creation

After creating the calculation, verify it works correctly:

1. **Check creation succeeded**
   - Confirm calculation appears in LeanIX Admin → Calculations
   - Verify target field and fact sheet type are correct
   - Check `invalid` is not `true`

2. **Review calculated values**
   - Activate the calculation and check field values on sample fact sheets in the UI
   - Verify results match expected values

3. **Review for edge cases**
   Before marking complete, consider:
   - What happens if source data is null/empty?
   - Does the return type match the target field type?
   - What if relations have zero items?
   - Can this calculation be simpler?

Ask: "Would you like me to review edge cases before we finalize?"

### Step 7: Ask for Refinements

Offer:
- Test the calculation
- Add edge case handling
- Create related calculations

---

## [Debug Failing Calculation] Workflow

### Step 1: Collect Information

Request: calculation code, error message (if any), expected vs actual behavior, calculation type.

### Step 2: Automated Diagnostic Checks

| Check | Issue | Fix |
|-------|-------|-----|
| `async` keyword | Calculation is async | Remove async - must be synchronous |
| `await` keyword | Using await | Remove - no async operations |
| `fetch` | API call attempted | Remove - not allowed in calculations |
| `import` | Import statement | Remove - no imports allowed |
| Export syntax | Missing `export` | Use `export function main()` |
| Return type | Returning object | Return single value |
| Data access (fact-sheet) | Using `data.factSheet` | Use `data.field` directly |
| Data access (relation) | Using `data.field` | Use `data.factSheet.field` |

### Step 3: Check Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid: true` | Syntax error in code | Check JS syntax |
| High `errorCount` | Runtime errors | Check null handling |
| High `configurationErrorCount` | Bad field/relation names | Verify against data model |
| No updates happening | Returning `undefined` | Return actual value or `null` |
| Wrong value type | Type mismatch | Return correct type for field |

### Step 4: Provide Diagnosis

Generate diagnostic report with issues found and recommended fixes.

### Step 5: Offer Corrected Code

Ask if user wants fully corrected calculation code generated.

---

## [Understand Capabilities] Workflow

**Can calculate:**
- Field values from same fact sheet (fact-sheet type)
- Field values from related fact sheet (relation type)
- Values from related fact sheets via relations
- Relation attributes
- Aggregations (count, sum, average, min, max)
- String operations
- Date calculations (days until/since)
- Conditional logic
- Multi-select collections

**Cannot calculate:**
- Values requiring API calls
- Values from fact sheets not directly related
- Real-time external data
- Values requiring async operations

**Target field types supported:**
- Double (decimal numbers)
- Integer (whole numbers)
- String (text)
- Single Select (enum)
- Multiple Select (array of enum)
- External ID (string)

**Target field limitations:**
- Base fields (built-in) cannot be targets
- Each field can have only ONE calculation
- Cannot create circular dependencies

→ **For detailed capabilities:** Load `references/LEANIX-MODEL.md`

---

## [Manage Workspace Calculations] Workflow

Use this workflow to query, analyze, fix, or reorganize existing calculations.

### Step 1: Connect to Workspace

Reuse workspace connection from "Create New Calculation" Step 1.

### Step 2: Discover Data Model

> **CRITICAL:** Query data model BEFORE fetching calculations to enable validation.

```
Tool: mcp__leanix__get_fact_sheet_types
```

Then inspect a sample fact sheet for each type of interest:

```
Tool: mcp__leanix__text_to_fact_sheets
Parameters: { "text": "{FactSheetType} fact sheets" }

Tool: mcp__leanix__get_fact_sheet_details
Parameters: { "fact_sheet_ids": ["{UUID}"], "fact_sheet_type": "{Type}" }
```

Store the data model for validation in subsequent steps.

### Step 3: Fetch All Calculations

```
Tool: mcp__leanix__list_calculations
```

Returns all calculations in the workspace with their metadata, status, and error counts.

> **Display rule:** Never surface raw API response metadata (`hasNextPage`, `nextCursor`, pagination counts) to the user. Only present calculation data itself.

### Step 4: Analyze Calculations

For each calculation, **validate against data model**:

| Check | Field | Issue If |
|-------|-------|----------|
| Naming convention | `name` | Doesn't follow pattern |
| Description | `description` | Empty or generic |
| Code quality | `code` | Contains debug statements, etc. |
| Target field exists | `affectedFieldKey` | Not in data model |
| Has errors | `errorCount` | > 0 |
| Has config errors | `configurationErrorCount` | > 0 |
| Has owner | `ownerId` | null |
| Is active | `status` | "inactive" when should be active |

**Report categories:**
- **Critical:** High error counts, invalid calculations
- **Warning:** Missing owners, empty descriptions
- **Info:** Naming convention suggestions

### Step 5: Fix Issues (Validating Against Data Model)

For each issue found:

**Update name/description/code:**
```
Tool: mcp__leanix__update_calculation
Parameters:
  id: "{UUID}"
  name: "New Name"           (optional)
  description: "New desc"    (optional)
  code: "..."                (optional)
```

**Set owner (lookup user ID first via MCP):**
```
Tool: mcp__leanix__search_users
Parameters: { "query": "user name or email" }
```
Use the `userId` field (not `id`) from the result, then:
```
Tool: mcp__leanix__update_calculation
Parameters:
  id: "{UUID}"
  owner_id: "{USER_UUID}"
```

**Enable/disable a calculation:**
```
Tool: mcp__leanix__enable_calculation
Parameters: { "id": "{UUID}" }

Tool: mcp__leanix__disable_calculation
Parameters: { "id": "{UUID}" }
```

### Step 6: Reorganize

**Delete unused/obsolete calculations:**
```
Tool: mcp__leanix__delete_calculation
Parameters: { "id": "{UUID}" }
```

**Create new calculations as needed:**
Follow the "Create New Calculation" workflow.

### Step 7: Present Report

Summarize:
- Total calculations analyzed
- Issues found by category
- Actions taken
- Recommendations for manual review

---

## Quick Reference

**Data Access Patterns:**

```javascript
// FACT-SHEET CALCULATIONS (type: "fact-sheet")
// Target: field on the fact sheet itself
data.fieldName                    // Direct field access
data.lifecycle.currentPhase       // Lifecycle phase ("plan", "phaseIn", "active", "phaseOut", "endOfLife")
data.naFields                     // string[] of field keys intentionally left blank (NA)
data.relationName                 // Relation array
data.relationName[0].factsheet    // Related fact sheet
data.relationName[0].factsheet.fieldName  // Field on related FS

// RELATION CALCULATIONS (type: "relation")
// Target: field on a relation
data.factSheet.fieldName          // Related fact sheet's field
data.factSheet.lifecycle.currentPhase  // Related fact sheet's lifecycle
data.factSheet.naFields           // NA fields on the related fact sheet
```

**Return Values:**
```javascript
return 42;                     // Number
return "text";                 // String
return "option1";              // Single select
return ["opt1", "opt2"];       // Multi-select
return null;                   // Clear field
return undefined;              // No change (AVOID - usually indicates bug)
```

---

## MCP Integration Points

### Discover Data Model

Use the GraphQL schema tools to discover workspace configuration:

```
Step 1: List available fact sheet types
Tool: mcp__leanix__list_graphql_types
Parameters: { "filter": "{FactSheetType}" }

Step 2: Fetch SDL for the relevant types
Tool: mcp__leanix__get_graphql_type_definitions
Parameters: { "type_names": ["{FactSheetType}", "{RelationType}"] }
```

Returns SDL with all fields, relations, and enum values for each type.

### Calculations CRUD

```
mcp__leanix__list_calculations         - List all calculations
mcp__leanix__get_calculation           - Get single calculation by ID
mcp__leanix__create_calculation        - Create new calculation
mcp__leanix__update_calculation        - Update existing calculation
mcp__leanix__delete_calculation        - Delete calculation
mcp__leanix__enable_calculation        - Set status to active
mcp__leanix__disable_calculation       - Set status to inactive
mcp__leanix__test_run_calculation      - Test code against a fact sheet/relation without saving
```

### Search Users
```
Tool: mcp__leanix__search_users
Use: Get owner ID for new calculations (use userId field, not id)
Parameters: { "email": "user@example.com" }
```

---

## External Documentation

- `CLAUDE.md` - Critical rules (root level)
- `.claude/docs/field-access-patterns.md` - Data access patterns
- `.claude/docs/supported-fields.md` - Target field types
- `.claude/docs/advanced-patterns.md` - Complex calculation patterns
- `examples/INDEX.md` - Working examples
