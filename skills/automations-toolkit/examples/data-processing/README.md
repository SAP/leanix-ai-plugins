# Data Processing Examples

Scripts for conditional field updates, default values, and data transformation.

---

## Scripts

| Script | Trigger | Description |
|--------|---------|-------------|
| [filter-applications.js](filter-applications.js) | Application Created/Updated | Sets default lifecycle, adds review tag if EOL approaching |

---

## filter-applications.js

Sets default lifecycle dates for Applications missing lifecycle data, and adds a review tag when End of Life is within one year.

### Automation Setup

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Application |
| **Trigger** | Fact sheet is created |
| **Action** | Run Script |

Alternatively, use "Field value is changed" on `lifecycle` for existing Applications.

### Logic

1. **Skip non-Applications**: Early return for other fact sheet types
2. **Set default lifecycle**: If lifecycle is missing, apply standard dates
3. **Add review tag**: If EOL is within 1 year and tag not present, add it

### Configuration

Update the default lifecycle dates:

```javascript
return {
  lifecycle: {
    plan: "2024-01-01",
    phaseIn: "2024-04-01",
    active: "2024-07-01",
    phaseOut: "2026-01-01",
    endOfLife: "2026-12-31",
  },
};
```

Update the review tag:

```javascript
// Change to your tag ID
if (!fs.tags?.includes("LIFECYCLE_REVIEW_NEEDED")) {
  return { tags: [...(fs.tags ?? []), "LIFECYCLE_REVIEW_NEEDED"] };
}
```

---

## Key Patterns

### Type Checking

```javascript
const fs = data.factSheet;
if (fs.type !== "Application") return {};
```

### Conditional Returns

```javascript
// Return different updates based on conditions
if (!fs.lifecycle) {
  return { lifecycle: defaultLifecycle };
}

if (needsReviewTag) {
  return { tags: [...currentTags, reviewTag] };
}

return {};  // No changes needed
```

### Date Comparison

```javascript
const eol = new Date(fs.lifecycle.endOfLife);
const oneYearFromNow = new Date();
oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

if (eol <= oneYearFromNow) {
  // EOL is within one year
}
```

---

## Lifecycle Object Structure

```javascript
{
  lifecycle: {
    plan: "YYYY-MM-DD",        // Planning phase start
    phaseIn: "YYYY-MM-DD",     // Phase-in start
    active: "YYYY-MM-DD",      // Active phase start
    phaseOut: "YYYY-MM-DD",    // Phase-out start
    endOfLife: "YYYY-MM-DD"    // End of life date
  }
}
```

---

## Common Use Cases

### Set Default Values on Create

```javascript
export function main() {
  const fs = data.factSheet;

  // Only on new fact sheets (check for missing required data)
  if (!fs.description) {
    return {
      description: "Please add a description.",
    };
  }
  return {};
}
```

### Transform Field Values

```javascript
export function main() {
  const fs = data.factSheet;

  // Standardize naming
  if (fs.name && !fs.name.startsWith("[APP]")) {
    return {
      name: `[APP] ${fs.name}`,
    };
  }
  return {};
}
```

### Clear Dependent Fields

```javascript
export function main() {
  const fs = data.factSheet;

  // If status is "deprecated", clear certain fields
  if (fs.status === "deprecated" && fs.primaryContact) {
    return {
      primaryContact: null,
    };
  }
  return {};
}
```
