/**
 * IT App Owner Guard
 *
 * Enforces a single Responsible IT App Owner per Application.
 * When more than one RESPONSIBLE subscription with the "IT App Owner" role exists,
 * keeps the oldest and deletes the rest.
 *
 * Trigger (on Application):
 *   - Subscription is added (type: RESPONSIBLE, role: IT App Owner)
 *
 * Logic:
 *   1. Query all subscriptions on the Application
 *   2. Filter to RESPONSIBLE subscriptions with the "IT App Owner" role
 *   3. If more than one exists, sort by createdAt ascending and delete all but the oldest
 *
 * JavaScript: ECMAScript 2023
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

export async function main() {
  const appId = data?.factSheet?.id;
  if (!appId || data?.factSheet?.type !== "Application") return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Step 1: Fetch all subscriptions on this Application
  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id
      subscriptions {
        edges {
          node {
            id
            type
            createdAt
            roles { id name }
          }
        }
      }
    }
  }`;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: appId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL query failed: ${JSON.stringify(json.errors)}`);

  const factSheet = json?.data?.factSheet;
  if (!factSheet) return {};

  // Step 2: Filter to RESPONSIBLE subscriptions with the "IT App Owner" role
  const itAppOwners = (factSheet.subscriptions?.edges || [])
    .map(e => e?.node)
    .filter(sub =>
      sub?.type === "RESPONSIBLE" &&
      sub?.roles?.some(role => role?.name === "IT App Owner")
    );

  // Nothing to do if zero or one owner
  if (itAppOwners.length <= 1) return {};

  // Step 3: Sort by createdAt ascending — keep the oldest, delete the rest
  itAppOwners.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const [, ...toRemove] = itAppOwners;

  // Step 4: Delete duplicate subscriptions
  for (const sub of toRemove) {
    const mutationRes = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation ($id: ID!) {
          deleteSubscription(id: $id) { id }
        }`,
        variables: { id: sub.id },
      }),
    });

    const mutationJson = await mutationRes.json();
    if (mutationJson?.errors) {
      // Skip this duplicate and continue with remaining
      continue;
    }
  }

  return {};
}
