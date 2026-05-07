# Lifecycle Management Automations

Scripts that react to lifecycle phase changes on fact sheets.

## BC End of Life - Break App Quality Seal

When a Business Context reaches End of Life, automatically break the quality seal on all related Applications.

### Use Case

When a Business Context is deprecated (End of Life), the related Applications should be reviewed. Breaking their quality seal forces Application owners to re-evaluate and update their Applications.

### Automation Setup

| Setting | Value |
|---------|-------|
| **Trigger** | Lifecycle state is reached |
| **Lifecycle Phase** | End of Life |
| **Fact Sheet Type** | Business Context |
| **Action** | Run Script |
| **Script** | `bc-eol-break-app-seal.js` |

**Note:** The "Lifecycle state is reached" trigger is checked **nightly**, not in real-time. The automation will run during the next nightly check after the lifecycle phase date is reached.

### Configuration

Update the script with your LeanIX instance:

```javascript
const graphqlUrl = "https://YOUR_INSTANCE.leanix.net/services/pathfinder/v1/graphql";
```

### Behavior

| Event | Result |
|-------|--------|
| BC lifecycle set to End of Life | `lxState` set to `BROKEN_QUALITY_SEAL` on all related Applications |
| Application already has `BROKEN_QUALITY_SEAL` | Skipped (no change) |
| BC has no related Applications | No action taken |

### What Happens After

Once an Application's quality seal is broken:
- It will appear in quality reports as needing attention
- Application owners will need to review and either:
  - Update the Application (remove the deprecated BC, etc.)
  - Re-approve the quality seal after review
