/**
 * Auto-Link ITComponents by Provider Name
 *
 * Trigger: Fact sheet is created (on Application)
 *
 * Logic:
 *   - When a new Application is created, queries all ITComponents in the workspace
 *   - Finds ITComponents whose displayName starts with a configured prefix (e.g., "Microsoft")
 *   - NOTE: displayName includes the linked Provider, e.g., "Microsoft Office 365" instead of just "Office 365"
 *   - Creates relApplicationToITComponent relations to all matching ITComponents
 *   - Marks auto-created relations with description marker for tracking
 *
 * Configuration:
 *   - Update GRAPHQL_URL with your LeanIX instance
 *   - Update NAME_PREFIX to match your desired Provider name
 *   - Optionally update AUTO_MARKER to customize the relation description
 *
 * Key Learnings:
 *   - Use `allFactSheets(factSheetType: ITComponent, ...)` instead of filter with facetFilters
 *   - Use `displayName` for ITComponents (includes Provider prefix) instead of `name`
 *   - Pagination with hasNextPage/endCursor works reliably for large datasets
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";
const NAME_PREFIX = "Microsoft";
const AUTO_MARKER = "[AUTO-MICROSOFT]";

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

  // Step 1: Get Application's current rev and existing relations
  const appQuery = `
    query ($id: ID!) {
      factSheet(id: $id) {
        id rev
        ... on Application {
          relApplicationToITComponent {
            edges {
              node {
                factSheet { id }
              }
            }
          }
        }
      }
    }
  `;

  const appRes = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: appQuery, variables: { id: appId } }),
  });

  const appJson = await appRes.json();
  if (appJson?.errors) throw new Error(`GraphQL query failed: ${JSON.stringify(appJson.errors)}`);

  const app = appJson?.data?.factSheet;
  if (!app) throw new Error("ABORT AUTOMATION RUN - Application not found");

  let currentRev = app.rev;

  // Get existing linked ITComponent IDs (to avoid duplicates)
  const existingItcIds = new Set(
    (app.relApplicationToITComponent?.edges || [])
      .map(e => e?.node?.factSheet?.id)
      .filter(Boolean)
  );

  // Step 2: Query all ITComponents - use displayName (includes Provider prefix)
  // IMPORTANT: Use factSheetType parameter, NOT filter with facetFilters
  const itcQuery = `
    query ($first: Int!, $after: String) {
      allFactSheets(factSheetType: ITComponent, first: $first, after: $after) {
        totalCount
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            displayName
            type
          }
        }
      }
    }
  `;

  const matchingItcs = [];
  let hasMore = true;
  let after = null;

  while (hasMore) {
    const itcRes = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: itcQuery,
        variables: {
          first: 200,
          after,
        },
      }),
    });

    const itcJson = await itcRes.json();
    if (itcJson?.errors) throw new Error(`ITComponent query failed: ${JSON.stringify(itcJson.errors)}`);

    const page = itcJson?.data?.allFactSheets;
    const itcs = (page?.edges || []).map(e => e?.node).filter(Boolean);

    // Filter by displayName (includes Provider, e.g., "Microsoft Office 365")
    for (const itc of itcs) {
      if (itc.displayName && itc.displayName.toLowerCase().startsWith(NAME_PREFIX.toLowerCase())) {
        matchingItcs.push(itc);
      }
    }

    hasMore = page?.pageInfo?.hasNextPage || false;
    after = page?.pageInfo?.endCursor || null;
  }

  // Step 3: Filter out already linked ITComponents (idempotency)
  const toLink = matchingItcs.filter(itc => !existingItcIds.has(itc.id));

  if (toLink.length === 0) {
    return {}; // Nothing to link
  }

  // Step 4: Create relations one by one with retry on REVISION_CLASH
  for (const itc of toLink) {
    let retries = 3;

    while (retries > 0) {
      const currentRev = await getCurrentRev(appId, token);
      if (!currentRev) throw new Error("Could not get Application rev");

      const patches = [
        {
          op: "add",
          path: `/relApplicationToITComponent/new_${itc.id}`,
          value: JSON.stringify({
            description: AUTO_MARKER,
            factSheetId: itc.id,
          }),
        },
      ];

      const mutRes = await fetch(GRAPHQL_URL, {
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

        // Skip if relation already exists
        if (errorMsg.includes("already exists")) {
          break;
        }

        // Retry on revision clash
        if (errorMsg.includes("REVISION_CLASH") && retries > 1) {
          retries--;
          continue;
        }

        throw new Error(`Failed to link ITComponent ${itc.displayName}: ${errorMsg}`);
      }
      break; // Success
    }
  }

  return {};
}
