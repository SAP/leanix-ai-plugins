# Calculation Naming Convention

Standard naming convention for LeanIX calculations.

---

> ## ⚠️ Workspace-Specific Relation Names
>
> Relation names in this document (e.g., `relApplicationToITComponent`) are **examples**.
>
> **Actual relation names vary by workspace configuration.**
>
> Always discover the correct relation names for your workspace before creating calculations:
>
> ```
> Step 1: mcp__leanix__list_graphql_types(filter="{FactSheetType}")
> Step 2: mcp__leanix__get_graphql_type_definitions(["{FactSheetType}", "{RelationType}"])
> ```

---

## Format

```
[Category] Target Field Description
```

**Components:**
- `[Category]` - Bracket-enclosed category prefix
- `Target Field Description` - Brief description of what the calculation produces

---

## Categories

| Category | Description | Example Use Cases |
|----------|-------------|-------------------|
| `[Count]` | Counting relations | ITC Count, User Group Count |
| `[Sum]` | Summing numeric values | Total Cost, Total Users |
| `[Avg]` | Averaging values | Average Rating, Mean Score |
| `[MinMax]` | Finding extremes | Earliest EOL, Highest Risk |
| `[Status]` | Status derivation | Derived Status, Lifecycle Flag |
| `[Score]` | Scoring calculations | Tech Debt Score, Completeness |
| `[Date]` | Date calculations | Days to EOL, Age in Months |
| `[Text]` | String operations | Display Label, Summary |
| `[Collect]` | Multi-select collection | Provider Types, Categories |
| `[Flag]` | Boolean/flag derivation | Is Critical, Needs Review |
| `[Default]` | Default value logic | Effective Criticality |

---

## Examples

### Good Names

| Name | Why It Works |
|------|--------------|
| `[Count] Linked IT Components` | Clear category and purpose |
| `[Sum] Total Annual IT Costs` | Describes aggregation and source |
| `[Status] Derived from Initiatives` | Shows derivation source |
| `[Score] Technical Debt Index` | Indicates scoring calculation |
| `[Date] Days Until EOL` | Clear date calculation |
| `[Collect] Unique Provider Types` | Multi-select purpose clear |

### Bad Names (Avoid)

| Bad Name | Problem | Better Name |
|----------|---------|-------------|
| `itcCount` | No category, too terse | `[Count] Linked IT Components` |
| `Calculate stuff` | Vague, no category | `[Sum] Related Item Values` |
| `Status` | Too generic | `[Status] Derived from Initiative Health` |
| `My calculation` | Not descriptive | `[Score] Application Maturity` |

---

## Description Format

Use a standardized description format:

```
Calculates: {what the field represents}

Sources: {fields and relations used}

Logic: {brief explanation of calculation}
```

**Example:**
```
Calculates: Number of linked IT Components in active lifecycle

Sources: relApplicationToITComponent, lifecycle.currentPhase on related ITCs

Logic: Counts relations where related ITC lifecycle is 'active'
```

---

## Custom Field Naming

Do **not** use the `lx` prefix for custom field keys. The `lx` prefix is reserved for official LeanIX extensions.

---

## Field Naming Alignment

Calculation names should align with target field names:

| Target Field | Calculation Name |
|--------------|------------------|
| `itcCount` | `[Count] Linked IT Components` |
| `totalITCCost` | `[Sum] Total IT Component Costs` |
| `techDebtScore` | `[Score] Technical Debt Index` |
| `daysToEOL` | `[Date] Days Until EOL` |
| `providerTypes` | `[Collect] Provider Types` |

---

## Bulk Naming Workflow

When standardizing calculation names via API:

1. **List calculations** - Use `mcp__leanix__list_calculations`
2. **Identify patterns** - Group by purpose
3. **Apply categories** - Based on calculation type
4. **Update via MCP** - Use `mcp__leanix__update_calculation`

**MCP call:**
```
Tool: mcp__leanix__update_calculation
Parameters:
  id: "UUID"
  name: "[Count] Linked IT Components"
```
