# Transitive Relations Examples

Scripts that automatically create relations through an intermediary fact sheet.

---

## Scripts

| Script | Trigger | Description |
|--------|---------|-------------|
| [app-bc-context-sync.js](app-bc-context-sync.js) | Relation added/removed (Application) | Auto-creates App → Business Context from App → BC → Context |
| [bc-propagate-context-to-apps.js](bc-propagate-context-to-apps.js) | Relation added/removed (Business Capability) | Same logic but triggered from BC side |

---

## Use Case

When an Application links to a Business Capability, and that Business Capability links to Business Contexts, the Application should automatically get relations to those Business Contexts.

```
Business Capability ←─── Application
        │
        ↓
Business Context ←─── [AUTO-CREATED] ─── Application
```

---

## Required Automations (4 total)

### From Application Side

#### Automation 1: App Relation Added

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Application |
| **Trigger** | Relation is added |
| **Action** | Run Script |
| **Script** | `app-bc-context-sync.js` |

#### Automation 2: App Relation Removed

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Application |
| **Trigger** | Relation is removed |
| **Action** | Run Script |
| **Script** | `app-bc-context-sync.js` |

### From Business Capability Side

#### Automation 3: BC Relation Added

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | BusinessCapability |
| **Trigger** | Relation is added |
| **Action** | Run Script |
| **Script** | `bc-propagate-context-to-apps.js` |

#### Automation 4: BC Relation Removed

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | BusinessCapability |
| **Trigger** | Relation is removed |
| **Action** | Run Script |
| **Script** | `bc-propagate-context-to-apps.js` |

---

## Configuration

Update GraphQL URL in both scripts:

```javascript
const graphqlUrl = "https://YOUR_INSTANCE.leanix.net/services/pathfinder/v1/graphql";
```

---

## How It Works

### Marker-Based Management

Auto-created relations include `[AUTO-BC-SYNC]` in the description field:

```javascript
const AUTO_MARKER = "[AUTO-BC-SYNC]";
```

This distinguishes:
- **Auto-created relations**: Managed by the script, can be removed
- **Manual relations**: Created by users, never touched by the script

### app-bc-context-sync.js

1. Query Application's:
   - Current Business Context relations (to find auto vs manual)
   - Linked Business Capabilities and their Business Contexts
2. Calculate desired Business Contexts (union from all BCs)
3. Add missing relations (with marker)
4. Remove orphaned marked relations

### bc-propagate-context-to-apps.js

1. Query the Business Capability's linked Applications
2. For each Application, run the same reconciliation logic

---

## Key Patterns

### Categorizing Relations

```javascript
for (const rel of currentRelations) {
  const description = rel.description || "";
  if (description.includes(AUTO_MARKER)) {
    autoRelations.push(rel);  // We manage these
  } else {
    manualContextIds.add(rel.factSheet.id);  // Never touch
  }
}
```

### Adding Relations

```javascript
const patches = [{
  op: "add",
  path: `/relApplicationToBusinessContext/new_${contextId}`,
  value: JSON.stringify({
    factSheetId: contextId,
    description: AUTO_MARKER,
  }),
}];
```

### Removing Relations

```javascript
const patches = [{
  op: "remove",
  path: `/relApplicationToBusinessContext/${relationId}`,
}];
```

---

## Behavior Matrix

| Event | Result |
|-------|--------|
| App links to BC | App gets relations to BC's Business Contexts |
| App unlinks from BC | Orphaned auto-relations removed |
| BC links to new Context | All linked Apps get new relation |
| BC unlinks from Context | All linked Apps lose auto-relation |
| User manually adds App → Context | Preserved, never modified |
| User removes auto-created relation | Will be re-created on next trigger |

---

## Limitations

1. **No filtering by relation type**: Triggers fire on ANY relation change, script checks internally
2. **Description-based tracking**: If users modify the marker, script may misbehave
3. **Performance**: Each trigger queries and potentially modifies multiple fact sheets

---

## Testing

1. Create Business Capability with Business Context relation
2. Link Application to the Business Capability
3. Verify Application gets relation to Business Context (with marker in description)
4. Unlink Application from Business Capability
5. Verify auto-created relation is removed
