# Utilities Examples

Validation scripts, helper patterns, and utility functions.

---

## Scripts

| Script | Trigger | Description |
|--------|---------|-------------|
| [data-validator.js](data-validator.js) | Fact Sheet Created/Updated | Validates required fields, aborts if invalid |

---

## data-validator.js

Validates fact sheet data and aborts the automation run if validation fails.

### Use Case

Ensure data quality by validating critical fields when fact sheets are created or updated. If validation fails, the automation aborts with an error message visible in the automation run history.

### Automation Setup

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Any (or specific type) |
| **Trigger** | Fact sheet is created |
| **Action** | Run Script |

### Current Validations

1. **Name required**: Fact sheet must have a non-empty name
2. **Application-specific**: Applications must have lifecycle and businessCriticality
3. **Prohibited tags**: Blocks saving if fact sheet has certain tags

### Configuration

Update prohibited tags:

```javascript
const prohibited = ["DEPRECATED", "DO_NOT_USE", "BLOCKED"];
```

Update the validation tag:

```javascript
return {
  tags: [...(fs.tags ?? []), "DATA_VALIDATED"],
```

---

## Key Pattern: Abort on Validation Failure

```javascript
if (!fs.name?.trim()) {
  throw new Error("ABORT AUTOMATION RUN - Missing fact sheet name");
}
```

The `throw new Error("ABORT AUTOMATION RUN - ...")` pattern:
- Stops the automation immediately
- Logs the error message in automation run history
- Does NOT prevent the fact sheet from being saved (validation happens after save)

**Important**: Automations run AFTER the fact sheet is saved. They cannot prevent a save. For preventing saves, use LeanIX validation rules instead.

---

## Common Validation Patterns

### Required Field

```javascript
if (!fs.fieldName?.trim()) {
  throw new Error("ABORT AUTOMATION RUN - Field 'fieldName' is required");
}
```

### Type-Specific Validation

```javascript
if (fs.type === "Application") {
  if (!fs.lifecycle) {
    throw new Error("ABORT AUTOMATION RUN - Applications require lifecycle");
  }
}
```

### Tag Validation

```javascript
const prohibitedTags = ["TAG_A", "TAG_B"];
if (fs.tags?.some(tag => prohibitedTags.includes(tag))) {
  throw new Error("ABORT AUTOMATION RUN - Prohibited tag detected");
}
```

### Date Validation

```javascript
if (fs.endDate && fs.startDate) {
  const start = new Date(fs.startDate);
  const end = new Date(fs.endDate);
  if (end < start) {
    throw new Error("ABORT AUTOMATION RUN - End date cannot be before start date");
  }
}
```

### Relation Validation

```javascript
// Requires GraphQL query first
const relatedItems = await queryRelations(fs.id);
if (relatedItems.length === 0) {
  throw new Error("ABORT AUTOMATION RUN - Must have at least one related item");
}
```

---

## Validation vs Abort

| Outcome | What Happens |
|---------|--------------|
| Validation passes | Script continues, can return updates |
| Validation fails (throw error) | Automation stops, error logged, no updates applied |
| Return empty object | Automation completes, no updates |

---

## Marking Validated Items

Add a tag or update a field to track validated items:

```javascript
// Only validate items that haven't been validated
if (fs.tags?.includes("DATA_VALIDATED")) {
  return {};  // Skip already validated
}

// Run validations...

// Mark as validated
return {
  tags: [...(fs.tags ?? []), "DATA_VALIDATED"],
};
```

---

## Limitations

1. **Post-save only**: Automations run after the fact sheet is saved
2. **No rollback**: Cannot undo the save if validation fails
3. **Async validation**: For complex validations requiring API calls, use `async function main()`

For pre-save validation, use LeanIX's built-in:
- Required field settings
- Validation rules
- Data model constraints
