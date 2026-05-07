# Basic Examples

Simple starter scripts for learning LeanIX automations.

---

## Scripts

| Script | Trigger | Description |
|--------|---------|-------------|
| [hello-world.js](hello-world.js) | Fact Sheet Created/Updated | Adds a "HELLO_WORLD" tag if not present |

---

## hello-world.js

The simplest possible automation script. Demonstrates:

- Basic tag manipulation
- Null-safe array handling
- Return object structure
- Idempotency (won't add duplicate tags)

### Automation Setup

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Any |
| **Trigger** | Fact sheet is created |
| **Action** | Run Script |

### Configuration

Replace the tag name with your own:

```javascript
// Change "HELLO_WORLD" to your tag name or tag ID
if (!data.factSheet.tags?.includes("YOUR_TAG")) {
```

### What It Does

1. Checks if the fact sheet already has the tag
2. If not, adds the tag to the existing tags array
3. Returns the updated tags list

### Key Patterns Demonstrated

```javascript
// Safe null handling for arrays
data.factSheet.tags ?? []

// Spread operator to append to array
[...(data.factSheet.tags ?? []), "NEW_TAG"]

// Return empty object when no changes needed
return {};
```

---

## Next Steps

Once you understand this script, try:

1. **[filter-applications.js](../data-processing/filter-applications.js)** - Conditional logic
2. **[data-validator.js](../utilities/data-validator.js)** - Validation and abort
3. **[energy-consumption-tagging.js](../tagging/energy-consumption-tagging.js)** - Field-based tagging
