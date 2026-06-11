# Calculation Templates

Ready-to-use templates for common calculation patterns.

**JavaScript Version:** ECMAScript 2024 (ES15)

> **Remember:** Calculations are synchronous. NO async/await, NO fetch(), NO imports.
> Return a single value matching the target field type.

---

## ⚠️ IMPORTANT: Customize Before Using

> **These templates use EXAMPLE values that may not exist in your workspace.**
>
> Before using any template:
>
> ### 1. Discover Your Data Model
>
> ```
> Step 1: mcp__leanix__list_graphql_types(filter="{FactSheetType}")
> Step 2: mcp__leanix__get_graphql_type_definitions(["{FactSheetType}", "{RelationType}"])
> ```
>
> The SDL response contains all fields, relations, and enum values.
>
> ### 2. Find Your Workspace's Actual Names
>
> Replace these example values with actual names from your workspace:
>
> | Example in Templates | What to Check |
> |---------------------|---------------|
> | `relApplicationToITComponent` | Your actual relation name |
> | `businessCriticality` | Your actual field name |
> | `annualCost` | Your actual numeric field name |
> | `missionCritical`, `businessCritical` | Your actual enum values |
>
> ### 3. Look for `// ← CUSTOMIZE` Comments
>
> Each template marks values that typically need customization.

---

## Template 1: Count Relations

Count the number of related fact sheets.

**Target Field Type:** Double or Integer

```javascript
/**
 * Count Related IT Components
 *
 * Fact Sheet Type: Application
 * Target Field: itcCount (Integer)
 * Logic: Returns the count of linked IT components
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ CUSTOMIZE FOR YOUR WORKSPACE                                 │
 * │                                                              │
 * │ 1. Query data model: see header (SDL workflow)             │
 * │ 2. Find YOUR relation name for the fact sheet type          │
 * │ 3. Replace RELATION_NAME below with your actual name        │
 * └─────────────────────────────────────────────────────────────┘
 */

export function main() {
  // ↓↓↓ CUSTOMIZE: Replace with YOUR workspace's relation name ↓↓↓
  const RELATION_NAME = "relApplicationToITComponent";
  // ↑↑↑ Discover via the SDL workflow (see header) ↑↑↑

  const relations = data[RELATION_NAME] ?? [];
  return relations.length;
}
```

**Customize:**
- Replace `RELATION_NAME` value with your actual relation name discovered via the SDL workflow

---

## Template 2: Sum Numeric Field

Sum a numeric field from all related fact sheets.

**Target Field Type:** Double

```javascript
/**
 * Sum Annual Costs from IT Components
 *
 * Fact Sheet Type: Application
 * Target Field: totalITCCost (Double)
 * Logic: Sums the annualCost field from all linked IT components
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ CUSTOMIZE FOR YOUR WORKSPACE                                 │
 * │                                                              │
 * │ 1. Query data model: see header (SDL workflow)             │
 * │ 2. Find YOUR relation name and numeric field name           │
 * │ 3. Replace constants below with your actual names           │
 * └─────────────────────────────────────────────────────────────┘
 */

export function main() {
  // ↓↓↓ CUSTOMIZE: Replace with YOUR workspace's names ↓↓↓
  const RELATION_NAME = "relApplicationToITComponent";
  const COST_FIELD = "annualCost";
  // ↑↑↑ Discover via the SDL workflow (see header) ↑↑↑

  const relations = data[RELATION_NAME] ?? [];

  const total = relations
    .map(r => r.factsheet?.[COST_FIELD] ?? 0)
    .reduce((sum, cost) => sum + cost, 0);

  return total;
}
```

**Customize:**
- Replace `RELATION_NAME` with your relation name discovered via the SDL workflow
- Replace `COST_FIELD` with your numeric field name

---

## Template 3: Average Value

Calculate the average of a numeric field from relations.

**Target Field Type:** Double

```javascript
/**
 * Average Risk Score
 *
 * Fact Sheet Type: Application
 * Target Field: avgRiskScore (Double)
 * Logic: Calculates average risk score from linked assessments
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ CUSTOMIZE FOR YOUR WORKSPACE                                 │
 * │                                                              │
 * │ 1. Query data model: see header (SDL workflow)             │
 * │ 2. Find YOUR relation name and numeric field name           │
 * │ 3. Replace constants below with your actual names           │
 * └─────────────────────────────────────────────────────────────┘
 */

export function main() {
  // ↓↓↓ CUSTOMIZE: Replace with YOUR workspace's names ↓↓↓
  const RELATION_NAME = "relApplicationToAssessment";
  const VALUE_FIELD = "riskScore";
  // ↑↑↑ Discover via the SDL workflow (see header) ↑↑↑

  const relations = data[RELATION_NAME] ?? [];

  if (relations.length === 0) {
    return null;  // Clear field if no relations
  }

  const values = relations
    .map(r => r.factsheet?.[VALUE_FIELD])
    .filter(v => v != null);

  if (values.length === 0) {
    return null;
  }

  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}
```

---

## Template 4: Min/Max Value

Find the minimum or maximum value from relations.

**Target Field Type:** Double

```javascript
/**
 * Earliest End of Life Date (as days from now)
 *
 * Fact Sheet Type: Application
 * Target Field: earliestEOL (Double)
 * Logic: Finds the minimum days until EOL across linked IT components
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ CUSTOMIZE FOR YOUR WORKSPACE                                 │
 * │                                                              │
 * │ 1. Query data model: see header (SDL workflow)             │
 * │ 2. Find YOUR relation name                                   │
 * │ 3. Replace RELATION_NAME below with your actual name        │
 * └─────────────────────────────────────────────────────────────┘
 */

export function main() {
  // ↓↓↓ CUSTOMIZE: Replace with YOUR workspace's relation name ↓↓↓
  const RELATION_NAME = "relApplicationToITComponent";
  // ↑↑↑ Discover via the SDL workflow (see header) ↑↑↑

  const relations = data[RELATION_NAME] ?? [];

  if (relations.length === 0) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysToEOL = relations
    .map(r => {
      const eolPhase = r.factsheet?.lifecycle?.phases?.find(p => p.phase === "endOfLife");
      if (!eolPhase?.startDate) return null;
      const eolDate = new Date(eolPhase.startDate);
      return Math.floor((eolDate - today) / (1000 * 60 * 60 * 24));
    })
    .filter(d => d != null);

  if (daysToEOL.length === 0) {
    return null;
  }

  return Math.min(...daysToEOL);  // Use Math.max for maximum
}
```

---

## Template 5: Derive Status (Simple Mapping)

Map a field value to a status enum.

**Target Field Type:** Single Select

```javascript
/**
 * Derive Criticality Status
 *
 * Fact Sheet Type: Application
 * Target Field: criticalityStatus (Single Select)
 * Logic: Maps businessCriticality to a simplified status
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ CUSTOMIZE FOR YOUR WORKSPACE                                 │
 * │                                                              │
 * │ 1. Query data model: see header (SDL workflow)             │
 * │ 2. Find YOUR source field name and its enum values          │
 * │ 3. Find YOUR target field's expected enum values            │
 * │ 4. Update SOURCE_FIELD and MAPPING below                    │
 * └─────────────────────────────────────────────────────────────┘
 */

export function main() {
  // ↓↓↓ CUSTOMIZE: Replace with YOUR workspace's field and enum values ↓↓↓
  const SOURCE_FIELD = "businessCriticality";

  // Map YOUR source enum values to YOUR target enum values
  const MAPPING = {
    missionCritical: "critical",      // ← Your source enum → target enum
    businessCritical: "critical",
    businessOperational: "important",
    administrativeService: "standard",
  };
  // ↑↑↑ Discover enum values via the SDL workflow (see header) ↑↑↑

  const sourceValue = data[SOURCE_FIELD];
  return MAPPING[sourceValue] ?? null;
}
```

---

## Template 6: Worst Case Tie-Breaker

When multiple relations exist, use worst-case logic.

**Target Field Type:** Single Select

```javascript
/**
 * Worst Initiative Status
 *
 * Fact Sheet Type: Application
 * Target Field: initiativeRisk (Single Select)
 * Logic: Returns worst status across all linked initiatives
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ CUSTOMIZE FOR YOUR WORKSPACE                                 │
 * │                                                              │
 * │ 1. Query data model: see header (SDL workflow)             │
 * │ 2. Find YOUR relation name and status field name            │
 * │ 3. Update PRIORITY array with YOUR enum values (worst first)│
 * └─────────────────────────────────────────────────────────────┘
 */

export function main() {
  // ↓↓↓ CUSTOMIZE: Replace with YOUR workspace's names ↓↓↓
  const RELATION_NAME = "relApplicationToInitiative";
  const STATUS_FIELD = "status";

  // Priority order: worst status first
  const PRIORITY = ["blocked", "at_risk", "on_track"];
  // ↑↑↑ Discover via the SDL workflow (see header) ↑↑↑

  const relations = data[RELATION_NAME] ?? [];

  if (relations.length === 0) {
    return null;
  }

  const statuses = relations
    .map(r => r.factsheet?.[STATUS_FIELD])
    .filter(Boolean);

  if (statuses.length === 0) {
    return null;
  }

  for (const status of PRIORITY) {
    if (statuses.includes(status)) {
      return status;
    }
  }

  return "unknown";
}
```

---

## Template 7: Best Case Tie-Breaker

When multiple relations exist, use best-case logic.

**Target Field Type:** Single Select

```javascript
/**
 * Best Provider Rating
 *
 * Fact Sheet Type: Application
 * Target Field: bestProviderRating (Single Select)
 * Logic: Returns best rating across all linked providers
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ CUSTOMIZE FOR YOUR WORKSPACE                                 │
 * │                                                              │
 * │ 1. Query data model: see header (SDL workflow)             │
 * │ 2. Find YOUR relation name and rating field name            │
 * │ 3. Update PRIORITY array with YOUR enum values (best first) │
 * └─────────────────────────────────────────────────────────────┘
 */

export function main() {
  // ↓↓↓ CUSTOMIZE: Replace with YOUR workspace's names ↓↓↓
  const RELATION_NAME = "relApplicationToProvider";
  const RATING_FIELD = "rating";

  // Priority order: best rating first
  const PRIORITY = ["platinum", "gold", "silver", "bronze"];
  // ↑↑↑ Discover via the SDL workflow (see header) ↑↑↑

  const relations = data[RELATION_NAME] ?? [];

  if (relations.length === 0) {
    return null;
  }

  const ratings = relations
    .map(r => r.factsheet?.[RATING_FIELD])
    .filter(Boolean);

  if (ratings.length === 0) {
    return null;
  }

  for (const rating of PRIORITY) {
    if (ratings.includes(rating)) {
      return rating;
    }
  }

  return null;
}
```

---

## Template 8: Days Until Date

Calculate days until or since a date.

**Target Field Type:** Double or Integer

```javascript
/**
 * Days Until End of Life
 *
 * Fact Sheet Type: Application
 * Target Field: daysToEOL (Integer)
 * Logic: Calculates days until the End of Life phase
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ CUSTOMIZE FOR YOUR WORKSPACE                                 │
 * │                                                              │
 * │ 1. Query data model: see header (SDL workflow)             │
 * │ 2. Verify lifecycle phases available in your workspace      │
 * │ 3. Update TARGET_PHASE if using a different phase           │
 * └─────────────────────────────────────────────────────────────┘
 */

export function main() {
  // ↓↓↓ CUSTOMIZE: Replace with YOUR target phase if different ↓↓↓
  const TARGET_PHASE = "endOfLife";
  // ↑↑↑ Standard phases: plan, phaseIn, active, phaseOut, endOfLife ↑↑↑

  const phases = data.lifecycle?.phases ?? [];
  const targetPhase = phases.find(p => p.phase === TARGET_PHASE);

  if (!targetPhase?.startDate) {
    return null;  // No date set
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(targetPhase.startDate);
  targetDate.setHours(0, 0, 0, 0);

  const diffMs = targetDate - today;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;  // Negative if past date
}
```

**Customize:**
- Replace `TARGET_PHASE` with your target lifecycle phase

---

## Template 9: String Concatenation

Combine multiple fields into a string.

**Target Field Type:** String

```javascript
/**
 * Generate Display Label
 *
 * Fact Sheet Type: Application
 * Target Field: displayLabel (String)
 * Logic: Combines name, version, and status into a label
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ CUSTOMIZE FOR YOUR WORKSPACE                                 │
 * │                                                              │
 * │ 1. Query data model: see header (SDL workflow)             │
 * │ 2. Find YOUR field names to concatenate                     │
 * │ 3. Update SOURCE_FIELDS array with your actual field names  │
 * │ 4. Adjust the formatting logic as needed                    │
 * └─────────────────────────────────────────────────────────────┘
 */

export function main() {
  // ↓↓↓ CUSTOMIZE: Replace with YOUR workspace's field names ↓↓↓
  const NAME_FIELD = "name";
  const VERSION_FIELD = "version";
  // ↑↑↑ Discover via the SDL workflow (see header) ↑↑↑

  const name = data[NAME_FIELD] ?? "Unknown";
  const version = data[VERSION_FIELD] ?? "";
  const status = data.lifecycle?.currentPhase ?? "";

  const parts = [name];

  if (version) {
    parts.push(`v${version}`);
  }

  if (status) {
    parts.push(`(${status})`);
  }

  return parts.join(" ");
}
```

**Customize:**
- Replace field names with your actual field names discovered via the SDL workflow
- Adjust the string format and separator as needed

---

## Template 10: Multi-Select Collection

Collect unique values from relations into a multi-select field.

**Target Field Type:** Multiple Select

```javascript
/**
 * Collect Provider Types
 *
 * Fact Sheet Type: Application
 * Target Field: providerTypes (Multiple Select)
 * Logic: Collects all unique provider types from linked providers
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ CUSTOMIZE FOR YOUR WORKSPACE                                 │
 * │                                                              │
 * │ 1. Query data model: see header (SDL workflow)             │
 * │ 2. Find YOUR relation name and field to collect             │
 * │ 3. Replace constants below with your actual names           │
 * └─────────────────────────────────────────────────────────────┘
 */

export function main() {
  // ↓↓↓ CUSTOMIZE: Replace with YOUR workspace's names ↓↓↓
  const RELATION_NAME = "relApplicationToProvider";
  const COLLECT_FIELD = "providerType";
  // ↑↑↑ Discover via the SDL workflow (see header) ↑↑↑

  const relations = data[RELATION_NAME] ?? [];

  if (relations.length === 0) {
    return null;  // Clear field if no relations
  }

  const types = relations
    .map(r => r.factsheet?.[COLLECT_FIELD])
    .filter(Boolean);

  // Return unique values
  return [...new Set(types)];
}
```

---

## Template 11: Conditional Logic

Apply if-then-else logic for field calculation.

**Target Field Type:** Single Select

```javascript
/**
 * Determine Retirement Eligibility
 *
 * Fact Sheet Type: Application
 * Target Field: retirementEligibility (Single Select)
 * Logic: Determines if application is eligible for retirement
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ CUSTOMIZE FOR YOUR WORKSPACE                                 │
 * │                                                              │
 * │ 1. Query data model: see header (SDL workflow)             │
 * │ 2. Find YOUR relation and field names                       │
 * │ 3. Update constants and enum values below                   │
 * └─────────────────────────────────────────────────────────────┘
 */

export function main() {
  // ↓↓↓ CUSTOMIZE: Replace with YOUR workspace's names ↓↓↓
  const USER_RELATION = "relApplicationToUserGroup";
  const CRITICALITY_FIELD = "businessCriticality";
  const LOW_CRITICALITY_VALUE = "administrativeService";
  // ↑↑↑ Discover via the SDL workflow (see header) ↑↑↑

  const lifecycle = data.lifecycle?.currentPhase;
  const userCount = (data[USER_RELATION] ?? []).length;
  const criticality = data[CRITICALITY_FIELD];

  // Already in phase out with no users
  if (lifecycle === "phaseOut" && userCount === 0) {
    return "eligible";
  }

  // Administrative with low/no users
  if (criticality === LOW_CRITICALITY_VALUE && userCount <= 1) {
    return "review";
  }

  // Active with users
  if (lifecycle === "active" && userCount > 0) {
    return "not_eligible";
  }

  return "review";  // Default for unclear cases
}
```

---

## Template 12: Scoring Matrix

Calculate a weighted score from multiple factors.

**Target Field Type:** Double

```javascript
/**
 * Calculate Technical Debt Score
 *
 * Fact Sheet Type: Application
 * Target Field: techDebtScore (Double)
 * Logic: Weighted score based on multiple factors (0-100)
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ CUSTOMIZE FOR YOUR WORKSPACE                                 │
 * │                                                              │
 * │ 1. Query data model: see header (SDL workflow)             │
 * │ 2. Find YOUR field names for scoring factors                │
 * │ 3. Find YOUR enum values for each field                     │
 * │ 4. Update field names, enum mappings, and weights below     │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Weights:
 *   - Age factor: 30%
 *   - Complexity: 25%
 *   - Maintenance effort: 25%
 *   - Documentation: 20%
 */

export function main() {
  // ↓↓↓ CUSTOMIZE: Adjust weights to match your scoring model ↓↓↓
  const WEIGHTS = {
    age: 0.30,
    complexity: 0.25,
    maintenance: 0.25,
    documentation: 0.20,
  };
  // ↑↑↑ Weights must sum to 1.0 ↑↑↑

  // Age score (based on years since creation)
  const createdAt = data.createdAt;
  let ageScore = 0;
  if (createdAt) {
    const years = (Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24 * 365);
    ageScore = Math.min(years * 10, 100);  // 10 years = 100
  }

  // ↓↓↓ CUSTOMIZE: Replace field names and enum values ↓↓↓
  const COMPLEXITY_FIELD = "complexity";
  const MAINTENANCE_FIELD = "maintenanceEffort";
  const DOCUMENTATION_FIELD = "documentationLevel";

  // Map YOUR enum values to scores (0-100)
  const complexityMap = { low: 20, medium: 50, high: 80, critical: 100 };
  const maintenanceMap = { minimal: 20, moderate: 50, high: 80, critical: 100 };
  const docMap = { complete: 10, partial: 40, minimal: 70, none: 100 };
  // ↑↑↑ Discover enum values via the SDL workflow (see header) ↑↑↑

  const complexityScore = complexityMap[data[COMPLEXITY_FIELD]] ?? 50;
  const maintenanceScore = maintenanceMap[data[MAINTENANCE_FIELD]] ?? 50;
  const docScore = docMap[data[DOCUMENTATION_FIELD]] ?? 50;

  // Weighted calculation
  const score = (
    ageScore * WEIGHTS.age +
    complexityScore * WEIGHTS.complexity +
    maintenanceScore * WEIGHTS.maintenance +
    docScore * WEIGHTS.documentation
  );

  return Math.round(score * 10) / 10;  // Round to 1 decimal
}
```

**Customize:**
- Replace field names with your actual field names discovered via the SDL workflow
- Update enum value mappings to match your workspace's Single Select options
- Adjust weights to match your scoring priorities (must sum to 1.0)

---

## Template 13: Completeness Check

Check if required fields are filled.

**Target Field Type:** Single Select or Double (percentage)

```javascript
/**
 * Data Completeness Status
 *
 * Fact Sheet Type: Application
 * Target Field: completenessStatus (Single Select)
 * Logic: Checks required fields and returns completeness level
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ CUSTOMIZE FOR YOUR WORKSPACE                                 │
 * │                                                              │
 * │ 1. Query data model: see header (SDL workflow)             │
 * │ 2. List YOUR required fields and relations                  │
 * │ 3. Update REQUIRED_FIELDS and REQUIRED_RELATIONS arrays     │
 * └─────────────────────────────────────────────────────────────┘
 */

export function main() {
  // ↓↓↓ CUSTOMIZE: Replace with YOUR workspace's field and relation names ↓↓↓
  const REQUIRED_FIELDS = [
    "description",
    "businessCriticality",
    "technicalFit",
    "functionalFit",
  ];

  const REQUIRED_RELATIONS = [
    "relApplicationToBusinessCapability",
    "relApplicationToITComponent",
  ];
  // ↑↑↑ Discover via the SDL workflow (see header) ↑↑↑

  // Check fields
  const filledFields = REQUIRED_FIELDS.filter(f => {
    const value = data[f];
    return value != null && value !== "";
  }).length;

  // Also check lifecycle
  const hasLifecycle = data.lifecycle?.currentPhase ? 1 : 0;

  // Check relations (at least one each)
  const filledRelations = REQUIRED_RELATIONS.filter(r =>
    (data[r] ?? []).length > 0
  ).length;

  const totalRequired = REQUIRED_FIELDS.length + 1 + REQUIRED_RELATIONS.length;
  const totalFilled = filledFields + hasLifecycle + filledRelations;

  const percentage = (totalFilled / totalRequired) * 100;

  if (percentage >= 100) return "complete";
  if (percentage >= 50) return "partial";
  return "incomplete";
}
```

**Alternative: Return Percentage**

```javascript
export function main() {
  // ... same logic ...
  return Math.round(percentage);  // Returns 0-100
}
```

---

## Template 14: Null Coalescing (Default Values)

Provide default values when source field is empty.

**Target Field Type:** Same as source field

```javascript
/**
 * Default Business Criticality
 *
 * Fact Sheet Type: Application
 * Target Field: effectiveCriticality (Single Select)
 * Logic: Uses businessCriticality or derives from relations
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ CUSTOMIZE FOR YOUR WORKSPACE                                 │
 * │                                                              │
 * │ 1. Query data model: see header (SDL workflow)             │
 * │ 2. Find YOUR field names, relation names, and enum values   │
 * │ 3. Update all constants below                               │
 * └─────────────────────────────────────────────────────────────┘
 */

export function main() {
  // ↓↓↓ CUSTOMIZE: Replace with YOUR workspace's names and values ↓↓↓
  const SOURCE_FIELD = "businessCriticality";
  const CAPABILITY_RELATION = "relApplicationToBusinessCapability";
  const USER_RELATION = "relApplicationToUserGroup";
  const HIGH_CRITICALITY = "high";
  const CRITICAL_RESULT = "businessCritical";
  const OPERATIONAL_RESULT = "businessOperational";
  const DEFAULT_RESULT = "administrativeService";
  // ↑↑↑ Discover via the SDL workflow (see header) ↑↑↑

  // First choice: explicit value
  if (data[SOURCE_FIELD]) {
    return data[SOURCE_FIELD];
  }

  // Second choice: derive from linked capabilities
  const capabilities = data[CAPABILITY_RELATION] ?? [];
  const criticalCapabilities = capabilities.filter(
    r => r.factsheet?.criticality === HIGH_CRITICALITY
  );

  if (criticalCapabilities.length > 0) {
    return CRITICAL_RESULT;
  }

  // Third choice: derive from user count
  const userGroups = data[USER_RELATION] ?? [];
  const totalUsers = userGroups
    .map(r => r.factsheet?.userCount ?? 0)
    .reduce((a, b) => a + b, 0);

  if (totalUsers > 1000) {
    return OPERATIONAL_RESULT;
  }

  // Default fallback
  return DEFAULT_RESULT;
}
```

---

## Choosing the Right Template

| Your Use Case | Template |
|---------------|----------|
| How many relations? | Template 1: Count Relations |
| Total of numeric field? | Template 2: Sum Numeric |
| Average value? | Template 3: Average |
| Find min or max? | Template 4: Min/Max |
| Map field to status? | Template 5: Derive Status |
| Worst value wins? | Template 6: Worst Case |
| Best value wins? | Template 7: Best Case |
| Days until/since? | Template 8: Days Until |
| Combine text fields? | Template 9: String Concat |
| Collect from relations? | Template 10: Multi-Select |
| If-then-else logic? | Template 11: Conditional |
| Weighted score? | Template 12: Scoring |
| Required fields check? | Template 13: Completeness |
| Default when empty? | Template 14: Null Coalescing |

---

## Common Patterns

### Safe Null Handling

```javascript
// Always use nullish coalescing
const relations = data.relationName ?? [];
const value = data.field ?? defaultValue;

// Optional chaining for nested access
const phase = data.lifecycle?.currentPhase;
const relatedField = data.rel?.[0]?.factsheet?.field;
```

### Type-Safe Returns

```javascript
// For numbers - ensure numeric return
return Number(value) || 0;

// For strings - ensure string return
return String(value) ?? "";

// For arrays - ensure array return
return Array.isArray(result) ? result : [result];
```

### Empty Relation Handling

```javascript
const relations = data.relationName ?? [];

if (relations.length === 0) {
  return null;  // Clear field when no relations
}

// ... calculate from relations ...
```
