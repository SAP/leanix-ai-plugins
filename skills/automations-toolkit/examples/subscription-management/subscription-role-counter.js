/**
 * Minimum Roles Per Application - Subscription Role Counter
 *
 * Trigger: Subscription is added/removed (on Application)
 *          OR Completion score is changed (to catch all updates)
 *
 * Logic:
 * - Counts total subscriptions assigned to an Application
 * - Updates the "serviceNow_Subscriptions" field with the count
 * - Business rule: Applications should have at least 5 subscriptions
 *
 * Note: This counts subscriptions, not role assignments within subscriptions.
 * E.g., if 2 users are subscribed, that counts as 2 (regardless of how many roles each has).
 */

export async function main() {
  const appId = data?.factSheet?.id;
  if (!appId || data?.factSheet?.type !== "Application") return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  const graphqlUrl = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

  // Query the Application with all subscriptions
  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id
      rev
      ... on Application {
        serviceNow_Subscriptions
        subscriptions {
          edges {
            node {
              id
              type
              user { id }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: appId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);

  const app = json?.data?.factSheet;
  if (!app) throw new Error("ABORT AUTOMATION RUN - Application not found");

  // Count total subscriptions
  const subscriptions = (app.subscriptions?.edges || []).map(e => e?.node).filter(Boolean);
  const totalCount = subscriptions.length;

  // Convert to string for the field (adjust if numeric field)
  const newValue = String(totalCount);
  const currentValue = app.serviceNow_Subscriptions;

  // Skip update if unchanged (prevents infinite loops)
  if (currentValue === newValue) {
    return {};
  }

  // Update the serviceNow_Subscriptions field via return object
  return { serviceNow_Subscriptions: newValue };
}
