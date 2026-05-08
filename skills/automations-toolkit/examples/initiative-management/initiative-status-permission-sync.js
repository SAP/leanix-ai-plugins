/**
 * Initiative Status to Application Permission Sync
 *
 * Trigger: Field Value Changed - initiativeStatus (Initiative)
 *
 * Logic (handles multiple Initiatives per Application):
 * - For each related Application, check ALL linked Initiatives
 * - If ANY Initiative is blocked/frozen → applicationPermission = "no"
 * - If ALL Initiatives are active → applicationPermission = "yes"
 * - If no Initiatives have a status (all cleared) → applicationPermission = cleared (null)
 *
 * Tie-breaker: Blocked/Frozen > Active
 */

// Helper to get current revision (for retry on REVISION_CLASH)
async function getCurrentRev(fsId, token, graphqlUrl) {
  const res = await fetch(graphqlUrl, {
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
  const initiativeId = data?.factSheet?.id;
  if (!initiativeId) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  const graphqlUrl = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

  // Get all Applications related to this Initiative
  const initQuery = `query ($id: ID!) {
    factSheet(id: $id) {
      ... on Initiative {
        relInitiativeToApplication {
          edges { node { factSheet { id } } }
        }
      }
    }
  }`;

  const initRes = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: initQuery, variables: { id: initiativeId } }),
  });

  const initJson = await initRes.json();
  if (initJson?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(initJson.errors)}`);

  const appIds = (initJson?.data?.factSheet?.relInitiativeToApplication?.edges || [])
    .map(e => e?.node?.factSheet?.id)
    .filter(Boolean);

  if (!appIds.length) return {};

  // For each Application, get ALL linked Initiatives and determine permission
  for (const appId of appIds) {
    const appQuery = `query ($id: ID!) {
      factSheet(id: $id) {
        id rev
        ... on Application {
          applicationPermission
          relApplicationToInitiative {
            edges { node { factSheet { ... on Initiative { initiativeStatus } } } }
          }
        }
      }
    }`;

    const appRes = await fetch(graphqlUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: appQuery, variables: { id: appId } }),
    });

    const appJson = await appRes.json();
    if (appJson?.errors) continue;

    const app = appJson?.data?.factSheet;
    if (!app) continue;

    // Get all Initiative statuses for this Application
    const statuses = (app.relApplicationToInitiative?.edges || [])
      .map(e => e?.node?.factSheet?.initiativeStatus)
      .filter(Boolean);

    // Determine permission based on all linked Initiatives
    let newPermission;
    if (statuses.length === 0) {
      // No Initiatives have status set → clear permission
      newPermission = null;
    } else if (statuses.some(s => s === "blocked" || s === "frozen")) {
      // Any blocked/frozen → no (tie-breaker: blocked/frozen wins)
      newPermission = "no";
    } else if (statuses.every(s => s === "active")) {
      // All active → yes
      newPermission = "yes";
    } else {
      // Mixed or unknown statuses → no change
      continue;
    }

    // Skip if unchanged
    if (app.applicationPermission === newPermission) continue;

    // Update Application permission with retry on REVISION_CLASH
    let retries = 3;
    while (retries > 0) {
      const currentRev = await getCurrentRev(app.id, token, graphqlUrl);
      if (!currentRev) throw new Error(`Could not get revision for ${app.id}`);

      const mutRes = await fetch(graphqlUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation ($id: ID!, $rev: Long!, $patches: [Patch]!) {
            updateFactSheet(id: $id, rev: $rev, patches: $patches, validateOnly: false) { factSheet { id } }
          }`,
          variables: {
            id: app.id,
            rev: currentRev,
            patches: [{ op: "replace", path: "/applicationPermission", value: newPermission }],
          },
        }),
      });

      const mutJson = await mutRes.json();
      if (mutJson?.errors) {
        const errorMsg = JSON.stringify(mutJson.errors);
        if (errorMsg.includes("REVISION_CLASH") && retries > 1) {
          retries--;
          continue;
        }
        throw new Error(`Mutation failed: ${errorMsg}`);
      }
      break; // Success
    }
  }

  return {};
}
