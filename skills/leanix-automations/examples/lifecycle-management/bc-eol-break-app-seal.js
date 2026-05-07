/**
 * Break Quality Seal on BC End of Life
 *
 * When a Business Context reaches "End of Life" lifecycle phase,
 * this script breaks the quality seal on all related Applications.
 *
 * Trigger (on Business Context):
 *   - Lifecycle state is reached: End of Life
 *
 * Logic:
 *   1. Query the Business Context and its related Applications
 *   2. For each Application, set quality seal to BROKEN
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
  const bcId = data?.factSheet?.id;
  if (!bcId || data?.factSheet?.type !== "BusinessContext") return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  const graphqlUrl = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

  // Query the Business Context and its related Applications
  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id name
      ... on BusinessContext {
        relBusinessContextToApplication {
          edges {
            node {
              factSheet {
                id name rev type
                lxState
              }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: bcId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);

  const bc = json?.data?.factSheet;
  if (!bc) return {};

  // Get related Applications
  const applications = (bc.relBusinessContextToApplication?.edges || [])
    .map(e => e?.node?.factSheet)
    .filter(app => app && app.type === "Application");

  if (applications.length === 0) return {};

  // Break quality seal on each Application with retry on REVISION_CLASH
  for (const app of applications) {
    // Skip if already broken
    if (app.lxState === "BROKEN_QUALITY_SEAL") continue;

    let retries = 3;
    while (retries > 0) {
      const currentRev = await getCurrentRev(app.id, token, graphqlUrl);
      if (!currentRev) {
        // Could not get revision, skip this app
        break;
      }

      const mutationRes = await fetch(graphqlUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation ($id: ID!, $rev: Long!, $patches: [Patch]!) {
            updateFactSheet(id: $id, rev: $rev, patches: $patches, validateOnly: false) {
              factSheet { id rev lxState }
            }
          }`,
          variables: {
            id: app.id,
            rev: currentRev,
            patches: [{
              op: "replace",
              path: "/lxState",
              value: "BROKEN_QUALITY_SEAL",
            }],
          },
        }),
      });

      const mutationJson = await mutationRes.json();
      if (mutationJson?.errors) {
        const errorMsg = JSON.stringify(mutationJson.errors);
        if (errorMsg.includes("REVISION_CLASH") && retries > 1) {
          retries--;
          continue;
        }
        // Other error or out of retries, continue with other Applications
        break;
      }
      break; // Success
    }
  }

  return {};
}
