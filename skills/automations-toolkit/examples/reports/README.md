# Reports Examples

Scripts for creating ToDo items, reports, and notifications.

---

## Scripts

| Script | Trigger | Description |
|--------|---------|-------------|
| [lifecycle-report.js](lifecycle-report.js) | Application Updated | Creates ToDo items for Applications in phaseOut or endOfLife |

---

## lifecycle-report.js

Creates ToDo action items when Applications reach critical lifecycle phases.

### Use Case

When an Application enters phase-out or end-of-life, create a ToDo item to notify the responsible team that a review is required.

### Automation Setup

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Application |
| **Trigger** | Lifecycle state is reached |
| **Lifecycle Phase** | Phase Out (or End of Life) |
| **Action** | Run Script |

**Note**: Create two automations - one for each phase, or use "Field value is changed" on lifecycle.

### Configuration

1. Update the API endpoint:

```javascript
await fetch("https://YOUR_INSTANCE.leanix.net/services/todo/v1/to-do", {
```

2. Update the assignee user ID:

```javascript
assignees: [{ id: "USER_ID_PLACEHOLDER" }],  // Replace with actual user ID
```

3. Update the due date:

```javascript
dueDate: "2025-12-31",  // Set appropriate due date
```

---

## ToDo API Basics

### Create ToDo Item

```javascript
await fetch("https://INSTANCE.leanix.net/services/todo/v1/to-do", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    factSheet: { id: factSheetId },
    title: "Action Required",
    category: "ACTION_ITEM",  // or "APPROVAL"
    description: "Description text here",
    assignees: [{ id: "user-id-here" }],
    dueDate: "YYYY-MM-DD",
  }),
});
```

### ToDo Categories

| Category | Description |
|----------|-------------|
| `ACTION_ITEM` | General action item |
| `APPROVAL` | Requires approval workflow |

### Finding User IDs

```graphql
{
  allUsers {
    edges {
      node {
        id
        displayName
        email
      }
    }
  }
}
```

---

## Key Patterns

### Phase Checking

```javascript
const phase = fs.lifecycle?.phase;
if (phase !== "phaseOut" && phase !== "endOfLife") return {};
```

### Tagging for Tracking

Add a tag to prevent duplicate ToDos:

```javascript
// Check if ToDo already created
if (fs.tags?.includes("TODO_CREATED")) return {};

// Create ToDo...

// Mark as done
return { tags: [...(fs.tags ?? []), "TODO_CREATED"] };
```

### Dynamic Due Dates

```javascript
// Due date 30 days from now
const dueDate = new Date();
dueDate.setDate(dueDate.getDate() + 30);
const dueDateStr = dueDate.toISOString().split('T')[0];  // YYYY-MM-DD
```

---

## Alternative: Use Built-in ToDo Actions

LeanIX Automations have built-in actions for creating ToDos without scripts:

| Action | Description |
|--------|-------------|
| Create To-Do: Action item | Creates action item with assignees |
| Create To-Do: Approval | Creates approval workflow |

These may be simpler for basic use cases. Use scripts when you need:
- Custom logic for assignee selection
- Dynamic content based on fact sheet data
- Conditional ToDo creation

---

## Email Notifications

For email notifications, use the built-in "Send Email" action or external webhooks. The ToDo API doesn't send emails directly.

### Send Email Action Fields

| Field | Limit |
|-------|-------|
| Subject | 200 characters |
| Body | Markdown supported |
| Recipients | Select from users/roles |
