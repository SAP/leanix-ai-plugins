# API Calls Examples

Scripts demonstrating external API integration patterns.

---

## Scripts

| Script | Trigger | Description |
|--------|---------|-------------|
| [fetch-fact-sheets.js](fetch-fact-sheets.js) | Fact Sheet Updated | Basic GraphQL query pattern, updates description |

---

## fetch-fact-sheets.js

Template script demonstrating the basic pattern for making GraphQL API calls.

### Automation Setup

| Setting | Value |
|---------|-------|
| **Fact Sheet Type** | Any |
| **Trigger** | Any |
| **Action** | Run Script |

### Configuration

```javascript
// Replace with your instance URL
const res = await fetch("https://YOUR_INSTANCE.leanix.net/services/pathfinder/v1/graphql", {
```

### Basic Pattern

```javascript
export async function main() {
  // 1. Get authentication token
  const token = context.secrets["default_automations_secret"].value.bearerToken;

  // 2. Make GraphQL request
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: `query { ... }`,
      variables: { ... }
    }),
  });

  // 3. Parse response
  const result = await res.json();

  // 4. Handle errors
  if (result.errors) {
    throw new Error(`GraphQL failed: ${JSON.stringify(result.errors)}`);
  }

  // 5. Process data
  const data = result.data.factSheet;

  // 6. Return updates (or empty object)
  return { description: "Updated" };
}
```

---

## Key Concepts

### Authentication

The bearer token is automatically provided by the LeanIX service. Access it in scripts:

```javascript
const token = context.secrets["default_automations_secret"].value.bearerToken;
```

### GraphQL Endpoints

| Service | URL Pattern |
|---------|-------------|
| Pathfinder (GraphQL) | `https://INSTANCE.leanix.net/services/pathfinder/v1/graphql` |
| ToDo API | `https://INSTANCE.leanix.net/services/todo/v1/to-do` |
| Integration API | `https://INSTANCE.leanix.net/services/integration-api/v1/...` |

### Error Handling

Always check for GraphQL errors:

```javascript
const result = await res.json();
if (result.errors) {
  throw new Error(`GraphQL failed: ${JSON.stringify(result.errors)}`);
}
```

The `throw new Error("ABORT AUTOMATION RUN - ...")` pattern stops the automation with a visible error message.

---

## Common API Patterns

### Query Single Fact Sheet

```javascript
const query = `query ($id: ID!) {
  factSheet(id: $id) {
    id name type rev
    description
  }
}`;

const res = await fetch(graphqlUrl, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { id: data.factSheet.id } }),
});
```

### Query with Relations (Inline Fragment Required)

```javascript
const query = `query ($id: ID!) {
  factSheet(id: $id) {
    id name
    ... on Application {
      relApplicationToITComponent {
        edges {
          node {
            factSheet { id name }
          }
        }
      }
    }
  }
}`;
```

### Mutation (Update Fact Sheet)

```javascript
const mutation = `mutation ($id: ID!, $rev: Long!, $patches: [Patch]!) {
  updateFactSheet(id: $id, rev: $rev, patches: $patches, validateOnly: false) {
    factSheet { id rev }
  }
}`;

const res = await fetch(graphqlUrl, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    query: mutation,
    variables: {
      id: factSheetId,
      rev: currentRev,
      patches: [
        { op: "replace", path: "/description", value: "New value" }
      ]
    }
  }),
});
```

### Paginated Query

```javascript
let allItems = [];
let hasMore = true;
let cursor = null;

while (hasMore) {
  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query ($first: Int!, $after: String) {
        allFactSheets(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          edges { node { id name } }
        }
      }`,
      variables: { first: 100, after: cursor }
    }),
  });

  const result = await res.json();
  const page = result.data.allFactSheets;

  allItems = allItems.concat(page.edges.map(e => e.node));
  hasMore = page.pageInfo.hasNextPage;
  cursor = page.pageInfo.endCursor;
}
```

