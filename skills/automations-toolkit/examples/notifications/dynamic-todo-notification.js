/**
 * Dynamic To-Do Notification
 *
 * Trigger: Field value changed on Application (businessCriticality)
 * Logic: Creates a To-Do for RESPONSIBLE subscribers when businessCriticality changes
 *
 * Use case: Notify application owners to review criticality changes.
 * LeanIX automatically emails To-Do assignees when a To-Do is created.
 *
 * JavaScript: ECMAScript 2023 (ES2023)
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";
const TODO_URL = "https://INSTANCE.leanix.net/services/todo/v1/to-do";

export async function main() {
  const fs = data?.factSheet;
  if (!fs?.id) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // 1. Fetch subscriptions via GraphQL (not available in data.factSheet)
  const query = "query($id:ID!){factSheet(id:$id){subscriptions{edges{node{type user{id email displayName}}}}}}";

  const gqlRes = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: query, variables: { id: fs.id } })
  });
  const subscriptionsData = await gqlRes.json();

  if (subscriptionsData?.errors) {
    throw new Error("GraphQL error: " + JSON.stringify(subscriptionsData.errors));
  }

  // 2. Get RESPONSIBLE subscribers
  const subscriptions = subscriptionsData?.data?.factSheet?.subscriptions?.edges || [];
  const responsibleUsers = subscriptions
    .filter(e => e?.node?.type === "RESPONSIBLE")
    .map(e => e?.node?.user)
    .filter(u => u?.id);

  // Skip if no responsible users
  if (responsibleUsers.length === 0) return {};

  // 3. Build To-Do payload
  // Note: data.trigger is not available in Run Script, use actual field value
  const criticalityValue = fs.businessCriticality || "not set";
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];

  const todoPayload = {
    factSheet: { id: fs.id },
    title: "Review: " + fs.displayName + " - Business Criticality changed",
    category: "ACTION_ITEM",
    description: "The Business Criticality of " + fs.displayName + " was changed to \"" + criticalityValue + "\". Please review this change and confirm it is correct.",
    assignees: responsibleUsers.map(u => ({ id: u.id })),
    dueDate: dueDate
  };

  // 4. Create To-Do
  const res = await fetch(TODO_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(todoPayload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error("To-Do creation failed: " + res.status + " - " + errorText);
  }

  return {};
}
