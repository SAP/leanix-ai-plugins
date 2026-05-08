/**
 * EOL Subscriber Downgrade
 *
 * When a Fact Sheet reaches "End of Life" lifecycle phase,
 * all RESPONSIBLE subscribers are downgraded to OBSERVER subscribers.
 *
 * Trigger (on any Fact Sheet type):
 *   - Lifecycle state is reached: End of Life
 *
 * Logic:
 *   1. Query the fact sheet with all subscriptions
 *   2. Find all RESPONSIBLE type subscriptions
 *   3. Update each RESPONSIBLE subscription to OBSERVER type
 *
 * Note: This uses updateSubscription mutation to change the subscription type.
 * Roles are cleared when converting to OBSERVER (OBSERVER type typically has no roles).
 */

export async function main() {
  const fsId = data?.factSheet?.id;
  if (!fsId) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  const graphqlUrl = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

  // Query the fact sheet with all subscriptions
  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id
      rev
      subscriptions {
        edges {
          node {
            id
            type
            user { id }
            roles { id name }
          }
        }
      }
    }
  }`;

  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: fsId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL query failed: ${JSON.stringify(json.errors)}`);

  const factSheet = json?.data?.factSheet;
  if (!factSheet) throw new Error("ABORT AUTOMATION RUN - Fact sheet not found");

  let currentRev = factSheet.rev;

  // Find all RESPONSIBLE subscriptions
  const subscriptions = (factSheet.subscriptions?.edges || [])
    .map(e => e?.node)
    .filter(Boolean);

  const responsibleSubs = subscriptions.filter(sub => sub.type === "RESPONSIBLE");

  if (responsibleSubs.length === 0) {
    return {}; // No RESPONSIBLE subscriptions to downgrade
  }

  // Downgrade each RESPONSIBLE subscription to OBSERVER
  for (const sub of responsibleSubs) {
    const updateRes = await fetch(graphqlUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation ($id: ID!, $fsRev: Long!, $user: UserInput!, $roles: [SubscriptionToSubscriptionRoleLinkInput]) {
          updateSubscription(id: $id, factSheetRev: $fsRev, user: $user, type: OBSERVER, roles: $roles) {
            id
            type
            factSheet { rev }
          }
        }`,
        variables: {
          id: sub.id,
          fsRev: currentRev,
          user: { id: sub.user.id },
          roles: [], // Empty roles array for OBSERVER
        },
      }),
    });

    const updateJson = await updateRes.json();
    if (updateJson?.errors) {
      // Continue with other subscriptions even if one fails
      continue;
    }

    // Update revision for next mutation
    currentRev = updateJson?.data?.updateSubscription?.factSheet?.rev ?? currentRev;
  }

  return {};
}
