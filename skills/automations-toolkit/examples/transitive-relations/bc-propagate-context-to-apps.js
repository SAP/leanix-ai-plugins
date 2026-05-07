/**
 * Business Capability - Propagate Business Context to Applications
 *
 * Triggers (on Business Capability):
 *   - Relation is added (when BC links to App OR Business Context)
 *   - Relation is removed (when BC unlinks from Business Context)
 *
 * Logic:
 *   - Finds all Applications linked to this Business Capability
 *   - For each Application, runs full reconciliation of Business Context relations
 *   - Auto-creates relations marked with [AUTO-BC-SYNC] in description
 *   - Auto-removes marked relations no longer justified by any BC
 *   - NEVER touches manual relations (those without the marker)
 *
 * Note: When BC->App relation is removed, the trigger fires here but we can't
 * see which App was removed. That case is handled by app-bc-context-sync.js
 * triggered on the Application side.
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";
const AUTO_MARKER = "[AUTO-BC-SYNC]";

// Helper to get current revision (for retry on REVISION_CLASH)
async function getCurrentRev(fsId, token) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query ($id: ID!) { factSheet(id: $id) { rev } }`,
      variables: { id: fsId }
    }),
  });
  return (await res.json())?.data?.factSheet?.rev;
}

export async function main() {
  const bcId = data?.factSheet?.id;
  if (!bcId || data?.factSheet?.type !== "BusinessCapability") return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  const graphqlUrl = GRAPHQL_URL;

  // Query this Business Capability's linked Applications
  const bcQuery = `
    query ($id: ID!) {
      factSheet(id: $id) {
        id
        name
        ... on BusinessCapability {
          relBusinessCapabilityToApplication {
            edges {
              node {
                factSheet { id name }
              }
            }
          }
        }
      }
    }
  `;

  const bcRes = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: bcQuery, variables: { id: bcId } }),
  });

  const bcJson = await bcRes.json();
  if (bcJson?.errors) throw new Error(`GraphQL query failed: ${JSON.stringify(bcJson.errors)}`);

  const bc = bcJson?.data?.factSheet;
  if (!bc) throw new Error("ABORT AUTOMATION RUN - Business Capability not found");

  // Get all Applications linked to this BC
  const apps = (bc.relBusinessCapabilityToApplication?.edges || [])
    .map(e => e?.node?.factSheet)
    .filter(Boolean);

  if (!apps.length) return {};

  // Reconcile each Application's Business Context relations
  for (const app of apps) {
    await reconcileAppBusinessContexts(app.id, token, graphqlUrl);
  }

  return {};
}

/**
 * Reconcile Business Context relations for a single Application
 * This is the same logic as app-bc-context-sync.js, extracted for reuse
 */
async function reconcileAppBusinessContexts(appId, token, graphqlUrl) {
  // Query the Application with all needed data
  const query = `
    query ($id: ID!) {
      factSheet(id: $id) {
        id
        rev
        name
        ... on Application {
          relApplicationToBusinessContext {
            edges {
              node {
                id
                description
                factSheet { id name }
              }
            }
          }
          relApplicationToBusinessCapability {
            edges {
              node {
                factSheet {
                  id
                  name
                  ... on BusinessCapability {
                    relBusinessCapabilityToBusinessContext {
                      edges {
                        node {
                          factSheet { id name }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: appId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`Query failed for App ${appId}: ${JSON.stringify(json.errors)}`);

  const app = json?.data?.factSheet;
  if (!app) return; // App might have been deleted

  // Calculate DESIRED Business Contexts from all linked Business Capabilities
  const desiredContexts = new Map();
  const linkedBCs = (app.relApplicationToBusinessCapability?.edges || [])
    .map(e => e?.node?.factSheet)
    .filter(Boolean);

  for (const bc of linkedBCs) {
    const contexts = (bc.relBusinessCapabilityToBusinessContext?.edges || [])
      .map(e => e?.node?.factSheet)
      .filter(Boolean);

    for (const ctx of contexts) {
      if (ctx.id) {
        desiredContexts.set(ctx.id, ctx.name || ctx.id);
      }
    }
  }

  // Categorize CURRENT Business Context relations
  const currentRelations = (app.relApplicationToBusinessContext?.edges || [])
    .map(e => e?.node)
    .filter(Boolean);

  const autoRelations = [];
  const manualContextIds = new Set();

  for (const rel of currentRelations) {
    const contextId = rel.factSheet?.id;
    if (!contextId) continue;

    const description = rel.description || "";
    if (description.includes(AUTO_MARKER)) {
      autoRelations.push({
        relationId: rel.id,
        contextId: contextId,
        contextName: rel.factSheet?.name || contextId,
      });
    } else {
      manualContextIds.add(contextId);
    }
  }

  const autoContextIds = new Set(autoRelations.map(r => r.contextId));

  // Calculate changes
  const toAdd = [...desiredContexts.entries()].filter(
    ([id]) => !autoContextIds.has(id) && !manualContextIds.has(id)
  );

  const toRemove = autoRelations.filter(r => !desiredContexts.has(r.contextId));

  // Apply additions with retry on REVISION_CLASH
  for (const [contextId] of toAdd) {
    let retries = 3;

    while (retries > 0) {
      const currentRev = await getCurrentRev(appId, token);
      if (!currentRev) throw new Error("Could not get Application rev");

      const patches = [
        {
          op: "add",
          path: `/relApplicationToBusinessContext/new_${contextId}`,
          value: JSON.stringify({
            factSheetId: contextId,
            description: AUTO_MARKER,
          }),
        },
      ];

      const mutRes = await fetch(graphqlUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation ($id: ID!, $rev: Long!, $patches: [Patch]!) {
              updateFactSheet(id: $id, rev: $rev, patches: $patches, validateOnly: false) {
                factSheet { rev }
              }
            }
          `,
          variables: { id: appId, rev: currentRev, patches },
        }),
      });

      const mutJson = await mutRes.json();
      if (mutJson?.errors) {
        const errorMsg = JSON.stringify(mutJson.errors);
        if (errorMsg.includes("REVISION_CLASH") && retries > 1) {
          retries--;
          continue;
        }
        throw new Error(`Failed to add relation: ${errorMsg}`);
      }
      break; // Success
    }
  }

  // Apply removals with retry on REVISION_CLASH
  for (const { relationId } of toRemove) {
    let retries = 3;

    while (retries > 0) {
      const currentRev = await getCurrentRev(appId, token);
      if (!currentRev) throw new Error("Could not get Application rev");

      const patches = [
        {
          op: "remove",
          path: `/relApplicationToBusinessContext/${relationId}`,
        },
      ];

      const mutRes = await fetch(graphqlUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation ($id: ID!, $rev: Long!, $patches: [Patch]!) {
              updateFactSheet(id: $id, rev: $rev, patches: $patches, validateOnly: false) {
                factSheet { rev }
              }
            }
          `,
          variables: { id: appId, rev: currentRev, patches },
        }),
      });

      const mutJson = await mutRes.json();
      if (mutJson?.errors) {
        const errorMsg = JSON.stringify(mutJson.errors);
        if (errorMsg.includes("REVISION_CLASH") && retries > 1) {
          retries--;
          continue;
        }
        throw new Error(`Failed to remove relation: ${errorMsg}`);
      }
      break; // Success
    }
  }
}
