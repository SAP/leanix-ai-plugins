# LeanIX EAM Meta-Model Reference (for Calculations)

Reference for LeanIX data model with focus on calculation-specific patterns.

---

> ## 🚨 CRITICAL: STATIC EXAMPLES ONLY
>
> **This file contains STATIC EXAMPLES from a standard LeanIX configuration.**
>
> Real workspaces have:
> - **Custom fact sheet types** — not just Application, ITComponent
> - **Custom relations** — not just `relApplicationToITComponent`
> - **Custom fields** — not just `businessCriticality`, `annualCost`
> - **Custom enum values** — not just `missionCritical`, `businessCritical`
>
> ### ALWAYS discover actual names before creating calculations:
>
> ```
> Step 1: mcp__leanix__list_graphql_types(filter="{FactSheetType}")
> Step 2: mcp__leanix__get_graphql_type_definitions(["{FactSheetType}", "{RelationType}"])
> ```
>
> The SDL response gives you all fields, relations, and enum values for the workspace.
>
> **Do NOT copy field, relation, or enum names from this file without verifying they exist in the workspace.** The names below are illustrative only — they show the *shape* of the data model, not the actual values your workspace uses.

---

## Live Workspace Discovery

This document provides a **static reference** for the standard LeanIX data model. For accurate, workspace-specific information:

| Method | How | Benefits |
|--------|-----|----------|
| **GraphQL SDL** | `mcp__leanix__list_graphql_types` + `mcp__leanix__get_graphql_type_definitions` | Complete schema — all fields, relations, enums, even unset ones |

**Live discovery provides:**
- Actual field names for your workspace
- Custom fact sheet types and fields
- Workspace-specific relations
- Available target field types and enum values

> **Note:** When live workspace data is available, it supersedes this static reference.

---

## Data Access in Calculations

### Direct Field Access

In calculations, access data directly (NOT via `data.factSheet`):

```javascript
// ✅ CORRECT for calculations
data.name
data.description
data.businessCriticality
data.customField

// ❌ WRONG (this is automations syntax)
data.factSheet.name
```

### Lifecycle Access

```javascript
data.lifecycle.currentPhase   // "plan", "phaseIn", "active", "phaseOut", "endOfLife"
// Per-phase start dates are keyed by phase name:
data.lifecycle.active         // "YYYY-MM-DD" or undefined
data.lifecycle.endOfLife      // "YYYY-MM-DD" or undefined
data.lifecycle.upcomingPhase  // next phase name, or null
```

### NA Fields (Intentionally Blank Relations)

`naFields` is a `string[]` of relation keys that have been intentionally marked as not applicable.

```javascript
// Fact-sheet calculation
data.naFields                          // e.g. ["relApplicationToOrganization"]

// Relation calculation
data.factSheet.naFields

// Check if a specific relation is intentionally blank
const isNA = (data.naFields ?? []).includes("relApplicationToOrganization");
```

### Relation Access

Relations return **arrays directly** - no GraphQL query needed:

```javascript
// Access relation array
const relations = data.relApplicationToITComponent ?? [];

// Count
const count = relations.length;

// Access first related fact sheet
const firstRelated = relations[0]?.factsheet;

// Access field on related fact sheet
const relatedName = relations[0]?.factsheet?.name;
const relatedPhase = relations[0]?.factsheet?.lifecycle?.currentPhase;

// Access relation attribute
const usageType = relations[0]?.usageType;
```

---

## Standard Fact Sheet Types

> **Illustrative only — discover actual types via the SDL workflow above.** The names below are common in default LeanIX configurations, but custom workspaces add, rename, or remove types.

| Type | API Value | Key Use Cases |
|------|-----------|---------------|
| **Application** | `Application` | Count ITCs, sum costs, derive status |
| **ITComponent** | `ITComponent` | Provider aggregation, lifecycle dates |
| **Provider** | `Provider` | Rating collection |
| **BusinessCapability** | `BusinessCapability` | Hierarchy rollups |
| **BusinessContext** | `BusinessContext` | Organizational mapping |
| **Initiative** | `Initiative` | Status propagation |
| **Product** | `Product` | Revenue calculation |
| **Project** | `Project` | Status aggregation |
| **UserGroup** | `UserGroup` | User count sums |
| **Interface** | `Interface` | Integration counts |
| **DataObject** | `DataObject` | Classification checks |
| **TechnicalStack** | `TechnicalStack` | Standards compliance |

---

## Standard Relations

> **Illustrative only — discover actual relation names via the SDL workflow above.** The naming pattern `rel{SourceType}To{TargetType}` is the default; custom workspaces may use different patterns or relation names entirely.

### From Application

| Relation Name | Target Type | Common Calculations |
|---------------|-------------|---------------------|
| `relApplicationToITComponent` | ITComponent | Count, sum costs, EOL dates |
| `relApplicationToBusinessCapability` | BusinessCapability | Coverage checks |
| `relApplicationToBusinessContext` | BusinessContext | Org alignment |
| `relApplicationToInitiative` | Initiative | Status derivation |
| `relApplicationToUserGroup` | UserGroup | User count |
| `relApplicationToDataObject` | DataObject | Data ownership |
| `relApplicationToInterface` | Interface | Integration count |
| `relToParent` | Application | Parent values |
| `relApplicationToProduct` | Product | Revenue |
| `relApplicationToProject` | Project | Project status |

### From ITComponent

| Relation Name | Target Type | Common Calculations |
|---------------|-------------|---------------------|
| `relITComponentToProvider` | Provider | Provider info |
| `relITComponentToTechnicalStack` | TechnicalStack | Standards compliance |
| `relToParent` | ITComponent | Hierarchy rollup |

### From BusinessCapability

| Relation Name | Target Type | Common Calculations |
|---------------|-------------|---------------------|
| `relBusinessCapabilityToBusinessContext` | BusinessContext | Org mapping |
| `relToParent` | BusinessCapability | Parent values |

---

## Relation Attributes

Some relations have attributes accessible directly:

| Relation | Attribute | Access |
|----------|-----------|--------|
| Application → ITComponent | `obsolescenceRiskStatus` | `rel[i].obsolescenceRiskStatus` |
| Application → ITComponent | `riskTargetDate` | `rel[i].riskTargetDate` |
| Application → ITComponent | `usageType` | `rel[i].usageType` |
| Interface relations | `dataFlowDirection` | `rel[i].dataFlowDirection` |

```javascript
// Example: Count by usage type
const relations = data.relApplicationToITComponent ?? [];
const usedCount = relations.filter(r => r.usageType === "used").length;
```

---

## Target Field Constraints

### Supported Target Field Types

| Type | JavaScript Return | Example |
|------|------------------|---------|
| `Double` | `number` | `return 3.14;` |
| `Integer` | `number` (integer) | `return 42;` |
| `String` | `string` | `return "text";` |
| `Single Select` | `string` (enum key) | `return "active";` |
| `Multiple Select` | `string[]` | `return ["a", "b"];` |
| `External ID` | `string` | `return "EXT-001";` |

### Cannot Target

- **Base fields** (id, name, type, rev, etc.) - Read-only
- **Lifecycle** - Managed separately
- **Tags** - Use automations for tag changes
- **Relations** - Cannot modify via calculations
- **Subscriptions** - Cannot modify via calculations

### One Calculation Per Field

Each target field can have **only one calculation**. Creating a second calculation for the same field will fail with a 409 Conflict error.

### Circular Dependency Prevention

A calculation **cannot read the target field** as a source:

```javascript
// ❌ ERROR: Circular dependency
// If targetAttribute is "itcCount"
export function main() {
  const current = data.itcCount;  // ERROR!
  return current + 1;
}
```

---

## Lifecycle Phases

Standard phases (in order):

| # | Phase | API Value |
|---|-------|-----------|
| 1 | Plan | `plan` |
| 2 | Phase In | `phaseIn` |
| 3 | Active | `active` |
| 4 | Phase Out | `phaseOut` |
| 5 | End of Life | `endOfLife` |

**Daily Recalculation:** Calculations using lifecycle or date fields may be recalculated daily to keep values current (e.g., "days until EOL").

---

## Common Field Types

### Built-in Fields (all fact sheet types)

| Field | Type | Calculation Access |
|-------|------|-------------------|
| `name` | String | `data.name` |
| `description` | String | `data.description` |
| `type` | String | `data.type` |
| `lifecycle` | Object | `data.lifecycle.currentPhase` |
| `createdAt` | DateTime | `data.createdAt` |
| `updatedAt` | DateTime | `data.updatedAt` |

### Custom Fields

Custom fields are workspace-specific. Common patterns:

| Pattern | Example Access |
|---------|---------------|
| Single select | `data.businessCriticality` |
| Multi select | `data.riskCategories` (returns array) |
| Number | `data.annualCost` |
| Date | `data.reviewDate` |
| Text | `data.notes` |
| Checkbox | `data.isApproved` |

---

## Type-Specific Fields

### Application

```javascript
data.businessCriticality   // Single select
data.technicalFit          // Single select
data.functionalFit         // Single select
data.alias                 // String
```

### ITComponent

```javascript
data.category              // Single select: software, hardware, service
data.version               // String
// Note: Use displayName for provider-prefixed name
```

### Provider

```javascript
data.quality               // Single select
data.costPerYear           // Number
data.contractExpiry        // Date
```

### Initiative

```javascript
data.initiativeStatus      // Single select: planned, active, blocked, completed
data.budget                // Number
data.startDate             // Date
data.endDate               // Date
```

---

## Data Quality Patterns

### Completeness Check

```javascript
const required = [
  data.description,
  data.businessCriticality,
  data.lifecycle?.currentPhase,
];

const filled = required.filter(f => f != null && f !== "").length;
const percentage = (filled / required.length) * 100;
```

### Relation Coverage

```javascript
const hasCapabilities = (data.relApplicationToBusinessCapability ?? []).length > 0;
const hasITComponents = (data.relApplicationToITComponent ?? []).length > 0;

const coverage = [hasCapabilities, hasITComponents].filter(Boolean).length;
```

---

## Aggregation Patterns

### Count with Filter

```javascript
const relations = data.relApplicationToITComponent ?? [];
const activeCount = relations.filter(
  r => r.factsheet?.lifecycle?.currentPhase === "active"
).length;
```

### Sum with Default

```javascript
const relations = data.relApplicationToITComponent ?? [];
const totalCost = relations
  .map(r => r.factsheet?.annualCost ?? 0)
  .reduce((sum, cost) => sum + cost, 0);
```

### Collect Unique

```javascript
const relations = data.relApplicationToITComponent ?? [];
const categories = [...new Set(
  relations
    .map(r => r.factsheet?.category)
    .filter(Boolean)
)];
```

---

## Debugging Tips

### Check Relation Data Structure

If a calculation isn't working, verify the data structure:

1. Ensure relation name is correct (case-sensitive)
2. Relations return arrays, not connections with edges/nodes
3. Related fact sheet is at `rel[i].factsheet`, not `rel[i].node.factSheet`

### Common Mistakes

| Mistake | Correct Pattern |
|---------|-----------------|
| `data.factSheet.field` | `data.field` |
| `rel.edges.map(e => e.node)` | `rel.map(r => r.factsheet)` |
| `data.rel.factSheet` | `data.rel[0].factsheet` |
| Async function | Synchronous `export function main()` |

---

## Extensibility

### Custom Fact Sheet Types

When working with custom types:
- Ask user for the type name
- Relations will be named `rel{CustomType}To{TargetType}`
- Fields follow same access patterns

### Custom Relations

When working with custom relations:
- Ask user for the relation name
- Check if relation has custom attributes
- Access pattern: `data.relCustomName[i].factsheet.field`
