# Initiative Management Examples

Scripts that sync fields based on related Initiative statuses.

---

## Scripts

| Script | Trigger | Description |
|--------|---------|-------------|
| [initiative-status-permission-sync.js](initiative-status-permission-sync.js) | Field value changed (Initiative) | Sets Application permission based on linked Initiative statuses |

---

## initiative-status-permission-sync.js

Syncs an Application's permission field based on ALL linked Initiative statuses using a tie-breaker pattern.

### Use Case

An Application may be linked to multiple Initiatives. The Application's permission should reflect the aggregate status:
- If **any** Initiative is blocked/frozen → Application permission = "no"
- If **all** Initiatives are active → Application permission = "yes"
- If no Initiatives have a status → Clear the permission field

### Automation Setup

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Initiative |
| **Trigger** | Field value is changed |
| **Field** | initiativeStatus |
| **Action** | Run Script |

### Configuration

```javascript
const graphqlUrl = "https://YOUR_INSTANCE.leanix.net/services/pathfinder/v1/graphql";
```

Update field names if different in your workspace:
- `initiativeStatus` - The status field on Initiative
- `applicationPermission` - The permission field on Application

---

## Key Pattern: Multi-Relation Tie-Breaker

When a trigger fires on one related fact sheet, query ALL related fact sheets to determine the correct state:

```javascript
// Get all Applications linked to this Initiative
const appIds = getLinkedApplications(initiativeId);

// For each Application, query ALL its Initiatives
for (const appId of appIds) {
  const app = await queryApplication(appId);

  // Get ALL Initiative statuses (not just the one that triggered)
  const statuses = app.relApplicationToInitiative.edges
    .map(e => e.node.factSheet.initiativeStatus)
    .filter(Boolean);

  // Apply tie-breaker logic
  let newPermission;
  if (statuses.length === 0) {
    newPermission = null;  // Clear if no statuses
  } else if (statuses.some(s => s === "blocked" || s === "frozen")) {
    newPermission = "no";  // Any blocking status wins
  } else if (statuses.every(s => s === "active")) {
    newPermission = "yes"; // All must be active
  } else {
    continue;  // Mixed/unknown - no change
  }
}
```

### Why Query ALL?

The trigger only tells us that "something changed on an Initiative." It doesn't tell us:
- Which Application to update (one Initiative may link to many Applications)
- What the other Initiatives' statuses are

By querying all linked Initiatives, we ensure the correct aggregate value regardless of which Initiative triggered.

---

## Behavior Matrix

| Scenario | Statuses | Result |
|----------|----------|--------|
| Single active Initiative | ["active"] | permission = "yes" |
| Multiple active Initiatives | ["active", "active"] | permission = "yes" |
| Any blocked Initiative | ["active", "blocked"] | permission = "no" |
| Any frozen Initiative | ["active", "frozen"] | permission = "no" |
| All statuses cleared | [] | permission = null (cleared) |
| Mixed unknown statuses | ["active", "planning"] | No change |

---

## Flow Diagram

```
Initiative A (active) ────┐
                          │
Initiative B (blocked) ───┼──→ Application X
                          │      ↓
Initiative C (active) ────┘   permission = "no"
                              (because B is blocked)
```

---

## Customization

### Different Tie-Breaker Logic

Modify the status evaluation for your business rules:

```javascript
// Example: Require majority active instead of all
const activeCount = statuses.filter(s => s === "active").length;
const totalCount = statuses.length;
if (activeCount > totalCount / 2) {
  newPermission = "yes";
}
```

### Different Status Values

Update the status checks for your field values:

```javascript
// If your statuses are different
if (statuses.some(s => s === "on_hold" || s === "cancelled")) {
  newPermission = "restricted";
}
```
