# Tagging Examples

Scripts that automatically add or remove tags based on various conditions.

---

## Scripts

| Script | Trigger | Description |
|--------|---------|-------------|
| [energy-consumption-tagging.js](energy-consumption-tagging.js) | Field value changed | Tags ITComponents with T-shirt size based on energy consumption |
| [relation-based-tagging.js](relation-based-tagging.js) | Relation added/removed | Tags Applications based on linked ITComponent types |
| [document-sensitivity-tagging.js](document-sensitivity-tagging.js) | Completion score changed | Tags based on attached document types |
| [risk-currency-rollup/](risk-currency-rollup/) | Relation added/removed, Tag added/removed | Rolls up worst Risk Currency tag from ITCs to Apps (10-automation suite, 2 scripts). See [subfolder README](risk-currency-rollup/README.md). |

---

## energy-consumption-tagging.js

Maps numeric field values to T-shirt size tags (XS/S/M/L/XL).

### Automation Setup

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | ITComponent |
| **Trigger** | Field value is changed |
| **Field** | energyConsumptionLevel |
| **Action** | Run Script |

### Configuration

Update the tag IDs for your workspace:

```javascript
const TAG_IDS = {
  XS: "your-xs-tag-id",
  S: "your-s-tag-id",
  M: "your-m-tag-id",
  L: "your-l-tag-id",
  XL: "your-xl-tag-id"
};
```

### Key Patterns

- **Mutually exclusive tags**: Only one T-shirt size tag at a time
- **Remove old, add new**: Clears existing energy tags before adding correct one
- **Clear on null**: Removes all energy tags if field is cleared

---

## relation-based-tagging.js

Tags Applications based on tags from linked ITComponents.

### Automation Setup (2 automations needed)

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Application |
| **Trigger 1** | Relation is added |
| **Trigger 2** | Relation is removed |
| **Action** | Run Script (same script for both) |

### Configuration

Update tag IDs:

```javascript
// Tags that exist ON the ITComponents
const ITC_TAG_IDS = {
  SERVER: "your-itc-server-tag-id",
  DATABASE: "your-itc-database-tag-id"
};

// Tags that will be ADDED to the Applications
const APP_TAG_IDS = {
  LINKED_TO_SERVER: "your-app-linked-server-tag-id",
  LINKED_TO_DATABASE: "your-app-linked-db-tag-id"
};
```

### Key Patterns

- **Reconciliation**: Same script handles both add and remove triggers
- **Query related tags**: Uses GraphQL to get tags from linked ITComponents
- **Preserve other tags**: Only manages specific tag set, leaves others unchanged

---

## document-sensitivity-tagging.js

Scans attached documents and applies sensitivity tags based on document types.

### Automation Setup

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Any |
| **Trigger** | Completion score is changed |
| **Action** | Run Script |

**Note**: Using "Completion score is changed" because it fires on most changes. For production, consider a more specific trigger if available.

### Configuration

1. Update tag IDs:

```javascript
const TAG_IDS = {
  architecture: "your-architecture-tag-id",
  business: "your-business-tag-id",
  security: "your-security-tag-id",
  noSensitiveContent: "your-no-sensitive-content-tag-id"
};
```

2. Update document type mapping:

```javascript
const DOCUMENT_TYPE_TO_TAG_KEY = {
  "documentation": "architecture",
  "policy": "business",
  "security": "security",
  // Add your document types...
};
```

### Key Patterns

- **Document API**: Queries attached documents via GraphQL
- **Type mapping**: Maps document types to sensitivity categories
- **Default tag**: Applies "No Sensitive Content" if no sensitive docs found

---

## Finding Tag IDs

Use GraphQL Explorer to find your tag IDs:

```graphql
{
  allTags {
    edges {
      node {
        id
        name
        tagGroup { name }
      }
    }
  }
}
```
