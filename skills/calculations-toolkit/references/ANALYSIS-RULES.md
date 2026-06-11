# Analysis Rules for LeanIX Calculations

This document describes all the analysis rules used to validate calculation code and workspace configurations.

---

## Code Analysis Rules

These rules detect issues in JavaScript calculation code.

### CALC-001: Async Function (Critical)

**Detection:** `async function` keyword in code

**Problem:** LeanIX calculations must be synchronous. The `async` keyword is not supported.

**Example (Bad):**
```javascript
async function main() {
  return data.count;
}
```

**Example (Good):**
```javascript
export function main() {
  return data.count;
}
```

**Fix:** Remove the `async` keyword from function declarations.

---

### CALC-002: Await Keyword (Critical)

**Detection:** `await` keyword anywhere in code

**Problem:** The `await` keyword implies async operations, which are not supported.

**Example (Bad):**
```javascript
export function main() {
  const result = await somePromise;
  return result;
}
```

**Fix:** Remove `await` and any async operations. Calculations can only use synchronous code.

---

### CALC-003: Fetch Call (Critical)

**Detection:** `fetch(` pattern in code

**Problem:** External API calls via `fetch()` are not allowed in calculations.

**Example (Bad):**
```javascript
export function main() {
  const response = fetch('/api/data');
  return response.json();
}
```

**Fix:** Remove all fetch calls. Calculations can only use data from the `data` object.

---

### CALC-004: Import Statement (Critical)

**Detection:** `import` statement at start of line

**Problem:** Imports are not supported. Only the `data` object is available globally.

**Example (Bad):**
```javascript
import { helper } from './utils';

export function main() {
  return helper(data.count);
}
```

**Fix:** Remove all import statements. Inline any helper functions.

---

### CALC-005: Missing Optional Chaining (Warning)

**Detection:** Property chains like `data.x.y` without `?.` operator

**Problem:** Accessing nested properties without optional chaining can cause runtime errors when intermediate properties are undefined.

**Example (Bad):**
```javascript
export function main() {
  return data.relApplicationToITComponent.length;
}
```

**Example (Good):**
```javascript
export function main() {
  return data.relApplicationToITComponent?.length ?? 0;
}
```

**Fix:** Use optional chaining (`?.`) and nullish coalescing (`??`) for safe property access.

**Note:** This rule does not flag `data.factSheet.x` patterns, which are valid for relation calculations.

---

### CALC-006: Object Return (Warning)

**Detection:** `return {` pattern

**Problem:** Calculations must return a single value, not an object.

**Example (Bad):**
```javascript
export function main() {
  return { count: 5, status: "active" };
}
```

**Example (Good):**
```javascript
export function main() {
  return 5;  // Return single value
}
```

**Fix:** Return a single value (number, string, or array for multi-select fields).

---

### CALC-007: Console Log (Info)

**Detection:** `console.log(`, `console.warn(`, `console.error(`, etc.

**Problem:** Console statements are useful for debugging but should be removed from production calculations — output is not visible at runtime.

**Example:**
```javascript
export function main() {
  return data.count;
}
```

**Note:** Console output is not visible in production calculations.

**Fix:** Remove console statements before creating the production calculation.

---

### CALC-008: Missing Export Main (Warning)

**Detection:** Missing `export function main()` declaration

**Problem:** All calculations must export a `main` function.

**Example (Bad):**
```javascript
function main() {
  return data.count;
}
```

**Example (Good):**
```javascript
export function main() {
  return data.count;
}
```

**Fix:** Add `export` keyword before `function main()`.

---

### CALC-009: Circular Dependency (Critical)

**Detection:** Code reads the target field that the calculation writes to

**Problem:** A calculation cannot read its own target field, as this creates a circular dependency.

**Example (Bad):**
```javascript
// Target field: itcCount
export function main() {
  const current = data.itcCount;  // WRONG: reading target field
  return current + 1;
}
```

**Fix:** Remove references to the target field. Calculate the value from other source fields.

---

### CALC-010: No Data Access (Critical)

**Detection:** Code doesn't access any `data.*` fields

**Problem:** Calculations must read at least one data field to be valid. The API rejects calculations that don't use any fields.

**Example (Bad):**
```javascript
export function main() {
  return 42;  // No data access
}
```

**Example (Good):**
```javascript
export function main() {
  // Must access at least one data field
  const _ = data.name;
  return 42;
}
```

**Fix:** Ensure the calculation reads at least one field from the `data` object.

---

### CALC-011: Require Statement (Critical)

**Detection:** `require(` pattern (CommonJS imports)

**Problem:** CommonJS `require()` statements are not supported, same as ES6 imports.

**Example (Bad):**
```javascript
const utils = require('./utils');

export function main() {
  return utils.process(data.count);
}
```

**Fix:** Remove all require statements. Inline any helper functions.

---

## Workspace Analysis Rules

These rules detect issues at the workspace level.

### Invalid Calculation (Critical)

**Detection:** `invalid: true` in calculation response

**Problem:** The calculation has a syntax error or invalid code that prevents execution.

**Action:** Fix the JavaScript syntax error in the calculation code.

---

### High Error Count (Critical)

**Detection:** `errorCount > 10`

**Problem:** The calculation is experiencing frequent runtime errors.

**Possible Causes:**
- Null/undefined values not handled
- Missing optional chaining
- Division by zero
- Invalid return types

**Action:** Review null handling and edge cases in calculation code.

---

### Configuration Error (Critical)

**Detection:** `configurationErrorCount > 0`

**Problem:** Field or relation names in the calculation don't match the workspace data model.

**Possible Causes:**
- Misspelled field name
- Field doesn't exist on fact sheet type
- Relation name doesn't exist
- Target field type mismatch

**Action:** Verify all field and relation names against the workspace data model.

---

### Duplicate Target (Critical)

**Detection:** Multiple calculations targeting the same `(affectedFactSheetType, affectedFieldKey)`

**Problem:** Only one calculation can target each field. Multiple calculations targeting the same field will conflict.

**Action:** Remove duplicate calculations, keeping only one per target field.

---

### Missing Owner (Warning)

**Detection:** `ownerId: null`

**Problem:** No owner assigned to the calculation, making accountability unclear.

**Action:** Assign an owner to the calculation.

---

### Missing Description (Warning)

**Detection:** Empty or very short `description` field

**Problem:** Calculations without descriptions are hard to understand and maintain.

**Action:** Add a meaningful description explaining the calculation's purpose and logic.

---

### Naming Convention (Info)

**Detection:** Name doesn't match `[Category] Name` pattern

**Problem:** Inconsistent naming makes calculations harder to organize and find.

**Recommended Pattern:** `[Category] Descriptive Name`

**Examples:**
- `[Count] Active IT Components`
- `[Sum] Annual Costs`
- `[Status] Risk Level`
- `[Date] Days to EOL`

**Action:** Rename calculation to follow the convention.

---

## Severity Levels

| Level | Icon | Meaning |
|-------|------|---------|
| **Critical** | ■ | Must be fixed - calculation will fail or cause errors |
| **Warning** | ▲ | Should be fixed - may cause issues or maintenance problems |
| **Info** | ○ | Suggested improvement - best practice recommendation |

---

## Using Analysis Commands

### List All Calculations

```
Tool: mcp__leanix__list_calculations
```

### Get Single Calculation Details

```
Tool: mcp__leanix__get_calculation
Parameters: { "id": "UUID" }
```

### Update a Calculation (Bulk Fixes)

```
Tool: mcp__leanix__update_calculation
Parameters:
  id: "UUID"
  name: "[Count] Linked IT Components"
  description: "..."
```

### Enable / Disable

```
Tool: mcp__leanix__enable_calculation   (set active)
Tool: mcp__leanix__disable_calculation  (set inactive)
Parameters: { "id": "UUID" }
```
