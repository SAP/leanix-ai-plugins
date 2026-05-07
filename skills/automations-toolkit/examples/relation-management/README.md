# Relation Management Examples

Scripts that update relation attributes (not the related fact sheet itself).

---

## Scripts

| Script | Trigger | Description |
|--------|---------|-------------|
| [obsolescence-risk-calculator.js](obsolescence-risk-calculator.js) | Application Updated | Calculates and sets obsolescenceRiskStatus on relations |

---

## obsolescence-risk-calculator.js

Automatically calculates the `obsolescenceRiskStatus` attribute on Application-to-ITComponent relations based on risk target dates and ITComponent lifecycle.

### Use Case

Track technology obsolescence risk on the Application level. When an ITComponent reaches End of Life or the risk target date passes, the relation's risk status should be updated.

### Automation Setup

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Application |
| **Trigger** | Completion score is changed (or specific field change) |
| **Action** | Run Script |

**Note**: "Completion score is changed" fires frequently. For production, consider using a more specific trigger like "Field value is changed" on a relevant field.

### Configuration

```javascript
const graphqlUrl = "https://YOUR_INSTANCE.leanix.net/services/pathfinder/v1/graphql";
```

### Logic

For each Application → ITComponent relation:

1. Skip if `riskTargetPlan` is null or `riskTargetDate` is empty
2. Get ITComponent's End of Life date from lifecycle
3. Calculate status:
   - If current date > riskTargetDate OR current date > EOL → `riskAccepted`
   - Otherwise → `riskAddressed`
4. Update relation attribute if changed

### Key Pattern: Relation Attribute Updates

Relation attributes are patched on the **parent fact sheet** using the **relation ID**:

```javascript
const patches = [{
  op: "replace",
  path: `/relApplicationToITComponent/${rel.id}`,  // rel.id = relation ID
  value: JSON.stringify({
    factSheetId: rel.factSheet.id,  // Related fact sheet ID
    obsolescenceRiskStatus: newStatus,
  }),
}];

await fetch(graphqlUrl, {
  // ... headers ...
  body: JSON.stringify({
    query: updateMutation,
    variables: {
      id: appId,        // Parent fact sheet ID
      rev: currentRev,
      patches
    },
  }),
});
```

### Important Distinctions

| Term | Meaning | Example |
|------|---------|---------|
| Parent fact sheet ID | The fact sheet that "owns" the relation | Application ID |
| Related fact sheet ID | The fact sheet on the other side | ITComponent ID |
| Relation ID | The unique ID of the relation itself | `rel.id` from the query |

### Query Structure

```graphql
query ($id: ID!) {
  factSheet(id: $id) {
    id rev
    ... on Application {
      relApplicationToITComponent {
        edges {
          node {
            id                          # Relation ID
            riskTargetPlan              # Relation attribute
            riskTargetDate              # Relation attribute
            obsolescenceRiskStatus      # Relation attribute
            factSheet {
              id                        # Related fact sheet ID
              ... on ITComponent {
                lifecycle { phases { phase startDate } }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## Available Relation Attributes

Common relation attributes (varies by relation type):

| Attribute | Type | Description |
|-----------|------|-------------|
| `obsolescenceRiskStatus` | Enum | Risk acceptance status |
| `riskTargetPlan` | Enum | Risk mitigation plan type |
| `riskTargetDate` | Date | Target date for risk mitigation |
| `description` | String | Relation description |
| `constrainingRelation` | Boolean | Whether relation is constraining |

Query your specific relation to see available attributes.
