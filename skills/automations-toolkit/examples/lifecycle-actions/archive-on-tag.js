/**
 * Archive Fact Sheet on Tag
 *
 * Trigger: Tag Added on Application (or any fact sheet type)
 * Logic: Archives the fact sheet when a specific tag (e.g., "Sunset") is added
 *
 * Use Case: Automate decommissioning workflow - when team adds "Sunset" tag,
 * the application is automatically archived with an audit comment.
 *
 * JavaScript: ECMAScript 2023 (ES2023)
 *
 * IMPORTANT: When deploying via the Automations API, use regular strings
 * (not template literals) for GraphQL queries to avoid "Invalid JavaScript code" errors.
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

export async function main() {
  const fsId = data?.factSheet?.id;
  if (!fsId) return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // Get current revision and status
  const queryRes = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "query ($id: ID!) { factSheet(id: $id) { id rev status } }",
      variables: { id: fsId }
    }),
  });

  const queryJson = await queryRes.json();
  if (queryJson?.errors) throw new Error("Query failed: " + JSON.stringify(queryJson.errors));

  const fs = queryJson?.data?.factSheet;
  if (!fs) return {};

  // Idempotency: Skip if already archived
  if (fs.status === "ARCHIVED") return {};

  // Archive the fact sheet with comment
  const mutRes = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "mutation ($id: ID!, $rev: Long!, $comment: String!, $patches: [Patch]!) { updateFactSheet(id: $id, rev: $rev, comment: $comment, patches: $patches, validateOnly: false) { factSheet { id rev status } } }",
      variables: {
        id: fsId,
        rev: fs.rev,
        comment: "Archived via automation - Sunset tag applied",
        patches: [{ op: "add", path: "/status", value: "ARCHIVED" }]
      },
    }),
  });

  const mutJson = await mutRes.json();
  if (mutJson?.errors) throw new Error("Archive failed: " + JSON.stringify(mutJson.errors));

  return {};
}
