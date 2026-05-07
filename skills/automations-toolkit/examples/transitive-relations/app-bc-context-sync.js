/**
 * Application Business Context Sync (via Business Capability)
 *
 * Triggers (on Application):
 *   - Relation is added (when App links to Business Capability)
 *   - Relation is removed (when App unlinks from Business Capability)
 *
 * Logic:
 *   - Calculates desired Business Contexts from all linked Business Capabilities
 *   - Auto-creates relations marked with [AUTO-BC-SYNC] in description
 *   - Auto-removes marked relations no longer justified by any BC
 *   - NEVER touches manual relations (those without the marker)
 *
 * Relationship chain:
 *   Business Capability -> Application
 *   Business Capability -> Business Context
 *   = Auto-create: Application -> Business Context
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
  const appId = data?.factSheet?.id;
  if (!appId || data?.factSheet?.type !== "Application") return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  const graphqlUrl = GRAPHQL_URL;

  // Query Application with:
  // - Current Business Context relations (to categorize auto vs manual)
  // - Linked Business Capabilities and their Business Contexts (to calculate desired state)
  const query = `
    query ($id: ID!) {
      factSheet(id: $id) {
        id
        rev
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
  if (json?.errors) throw new Error(`GraphQL query failed: ${JSON.stringify(json.errors)}`);

  const app = json?.data?.factSheet;
  if (!app) throw new Error("ABORT AUTOMATION RUN - Application not found");

  // Step 1: Calculate DESIRED Business Contexts (union from all linked BCs)
  const desiredContexts = new Map(); // id -> name (for logging)
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

  // Step 2: Categorize CURRENT Business Context relations
  const currentRelations = (app.relApplicationToBusinessContext?.edges || [])
    .map(e => e?.node)
    .filter(Boolean);

  const autoRelations = []; // Relations we manage (have marker)
  const manualContextIds = new Set(); // Context IDs with manual relations

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

  // Step 3: Calculate changes
  // ADD: Desired contexts that have no relation (auto or manual)
  const toAdd = [...desiredContexts.entries()].filter(
    ([id]) => !autoContextIds.has(id) && !manualContextIds.has(id)
  );

  // REMOVE: Auto relations where context is no longer in desired set
  const toRemove = autoRelations.filter(r => !desiredContexts.has(r.contextId));

  // Step 4: Apply additions with retry on REVISION_CLASH
  for (const [contextId, contextName] of toAdd) {
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
        throw new Error(`Failed to add relation to ${contextName}: ${errorMsg}`);
      }
      break; // Success
    }
  }

  // Step 5: Apply removals with retry on REVISION_CLASH
  for (const { relationId, contextName } of toRemove) {
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
        throw new Error(`Failed to remove relation to ${contextName}: ${errorMsg}`);
      }
      break; // Success
    }
  }

  return {};
}
