/**
 * Link Application to Microsoft IT Components
 *
 * Trigger: Fact sheet is created (Application)
 * Logic: Finds all IT Components with Microsoft as provider and creates relations
 *
 * JavaScript: ECMAScript 2023 (ES2023)
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";
const MICROSOFT_PROVIDER_ID = "00000000-0000-0000-0000-000000000001";  // Replace with your workspace IDs

export async function main() {
  const appId = data?.factSheet?.id;
  if (!appId) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Query all IT Components with Microsoft as provider
  const query = `query {
    allFactSheets(factSheetType: ITComponent) {
      edges {
        node {
          id
          rev
          ... on ITComponent {
            relITComponentToProvider {
              edges {
                node {
                  factSheet {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);

  // Filter IT Components that have Microsoft as provider
  const itComponents = (json?.data?.allFactSheets?.edges || [])
    .map(e => e?.node)
    .filter(Boolean)
    .filter(itc => {
      const providers = (itc.relITComponentToProvider?.edges || [])
        .map(e => e?.node?.factSheet?.id)
        .filter(Boolean);
      return providers.includes(MICROSOFT_PROVIDER_ID);
    });

  if (itComponents.length === 0) return {};

  // Helper to get current revision
  async function getCurrentRev() {
    const appQuery = `query ($id: ID!) {
      factSheet(id: $id) { id rev }
    }`;
    const appRes = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: appQuery, variables: { id: appId } }),
    });
    const appJson = await appRes.json();
    return appJson?.data?.factSheet?.rev;
  }

  // Create relation to each Microsoft IT Component with retry on revision clash
  for (const itc of itComponents) {
    let retries = 3;

    while (retries > 0) {
      const currentRev = await getCurrentRev();
      if (!currentRev) throw new Error("Could not get Application rev");

      const mutation = `mutation ($id: ID!, $rev: Long!, $patches: [Patch]!) {
        updateFactSheet(id: $id, rev: $rev, patches: $patches, validateOnly: false) {
          factSheet { rev }
        }
      }`;

      const mutRes = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: mutation,
          variables: {
            id: appId,
            rev: currentRev,
            patches: [{
              op: "add",
              path: "/relApplicationToITComponent/new_" + itc.id.substring(0, 8),
              value: JSON.stringify({ factSheetId: itc.id }),
            }],
          },
        }),
      });

      const mutJson = await mutRes.json();

      if (mutJson?.errors) {
        const errorMsg = JSON.stringify(mutJson.errors);

        // Skip if relation already exists
        if (errorMsg.includes("already exists")) {
          break;
        }

        // Retry on revision clash
        if (errorMsg.includes("REVISION_CLASH") && retries > 1) {
          retries--;
          continue;
        }

        throw new Error(`Mutation failed: ${errorMsg}`);
      }

      // Success - move to next IT Component
      break;
    }
  }

  return {};
}
