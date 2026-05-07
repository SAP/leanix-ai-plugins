# Business Context Propagation to Parent Applications

Automatically propagates Business Context relations from child Applications to their parent Applications.

## Use Case

When a Business Context is linked to a child Application (e.g., "Adobe Premiere Pro"), the same Business Context should automatically be linked to the parent Application (e.g., "Adobe Creative Cloud").

When the Business Context is removed from the child, it should also be removed from the parent (unless another child still has it).

## How It Works

1. **Inherited relations are marked**: BCs propagated to parents include `[Auto-inherited from: Child App Name]` in the description field
2. **Child names tracked**: Description shows which children have the BC (e.g., `[Auto-inherited from: Adobe Premiere Pro, Adobe After Effects]`)
3. **Manual relations preserved**: BCs manually added to parents are NOT affected
4. **Multi-child support**: If multiple children have the same BC, it's only added once to the parent with all child names listed
5. **Multi-level hierarchy**: Propagation cascades automatically through the hierarchy (child → parent → grandparent)

## Required Automations

Create **4 automations** in LeanIX:

### Automation 1: BC Propagate to Parent - On Add

| Setting | Value |
|---------|-------|
| **Trigger** | Relation is added |
| **Fact Sheet Type** | Application |
| **Action** | Run Script |
| **Script** | `bc-propagate-to-parent.js` |

### Automation 2: BC Propagate to Parent - On Remove

| Setting | Value |
|---------|-------|
| **Trigger** | Relation is removed |
| **Fact Sheet Type** | Application |
| **Action** | Run Script |
| **Script** | `bc-propagate-to-parent.js` |

### Automation 3: BC Cleanup on Child Unlink (from parent side)

| Setting | Value |
|---------|-------|
| **Trigger** | Relation is removed |
| **Fact Sheet Type** | Application |
| **Action** | Run Script |
| **Script** | `bc-cleanup-on-child-unlink.js` |

**Why Automation 3?** When parent removes `relToChild`, this triggers on the parent and reconciles.

### Automation 4: BC Reconcile Former Parent (from child side)

| Setting | Value |
|---------|-------|
| **Trigger** | Relation is removed |
| **Fact Sheet Type** | Application |
| **Action** | Run Script |
| **Script** | `bc-reconcile-all-parents.js` |

**Why Automation 4?** When child removes its `relToParent`, the trigger fires on the child but it can no longer see its former parent. This script queries ALL Applications with inherited BC relations and reconciles each one based on their current children. This is a "catch all" that doesn't rely on description text matching.

## Configuration

Before deploying, update all scripts:

1. Replace `INSTANCE` with your LeanIX instance name:
   ```javascript
   const graphqlUrl = "https://YOUR_INSTANCE.leanix.net/services/pathfinder/v1/graphql";
   ```

## Behavior Matrix

| Event | Result |
|-------|--------|
| BC added to child | BC added to parent with description `[Auto-inherited from: Child Name]` |
| BC removed from child (other children still have it) | Description updated to remove child name |
| BC removed from child (no children have it) | BC removed from parent |
| Child unlinked from parent (from parent side) | Automation 3 reconciles parent's BCs |
| Child removes itself from parent (from child side) | Automation 4 finds former parent and reconciles |
| Child unlinked (no remaining children have BC) | BC removed from parent |
| BC manually added to parent | Preserved, not managed by automation |
| Multiple children have same BC | Description lists all: `[Auto-inherited from: Child1, Child2]` |

## Multi-Level Hierarchy

The automation cascades automatically:

```
Grandparent (G)
    └── Parent (P)
          └── Child (C) ← BC added here
```

1. BC added to Child C triggers Automation 1
2. Script adds BC to Parent P (marked as inherited)
3. Adding BC to P triggers Automation 1 again (it's a relation add)
4. Script adds BC to Grandparent G (marked as inherited)

## Limitations

1. **Relation type triggers**: LeanIX doesn't allow filtering triggers by specific relation type. These automations fire on ANY relation add/remove, but the script checks if a parent exists before doing anything.

2. **Performance**: Each BC add/remove makes GraphQL calls. For bulk operations, consider temporarily disabling automations.

3. **Race conditions**: If multiple BCs are added simultaneously, revision conflicts may occur. The script will error, but the next trigger will reconcile.

4. **Automation 4 efficiency**: When a child removes `relToParent`, Automation 4 queries ALL Applications with inherited BC relations and reconciles each one. This is intentionally a "catch all" approach that doesn't rely on description text (which users could modify). For workspaces with many parent Applications, this may take longer but is guaranteed to work.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| BCs not propagating | Check bearer token is valid, check parent-child relationship exists |
| BCs not being removed | Ensure the BC was marked as inherited (check description field) |
| Revision conflict errors | Re-run the automation or make any small change to trigger reconciliation |
