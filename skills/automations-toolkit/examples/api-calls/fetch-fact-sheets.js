/**
 * External API Call with Description Update
 *
 * Trigger: Fact Sheet Updated
 * Logic: Fetches fact sheet data via GraphQL and updates description with timestamp (idempotent)
 *
 * IMPORTANT: Replace "INSTANCE" with your LeanIX instance name (e.g., "mycompany" for mycompany.leanix.net)
 */

export async function main() {
  // Safe secret access with validation
  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // TODO: Replace INSTANCE with your LeanIX instance name
  const graphqlUrl = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id
      name
      description
    }
  }`;

  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { id: data.factSheet.id },
    }),
  });

  const result = await res.json();
  if (result?.errors) throw new Error(`GraphQL query failed: ${JSON.stringify(result.errors)}`);

  const fsData = result?.data?.factSheet;
  if (!fsData) throw new Error("ABORT AUTOMATION RUN - Fact sheet not found");

  // Use marker blocks for idempotent description updates
  const startMarker = "<!-- AUTO:LAST_UPDATED:START -->";
  const endMarker = "<!-- AUTO:LAST_UPDATED:END -->";
  const newBlock = `${startMarker}\nLast API fetch: ${new Date().toISOString()}\n${endMarker}`;

  let description = fsData.description || "";
  const startIdx = description.indexOf(startMarker);
  const endIdx = description.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing block
    description = description.slice(0, startIdx) + newBlock + description.slice(endIdx + endMarker.length);
  } else {
    // Append new block
    description = description + (description ? "\n\n" : "") + newBlock;
  }

  return { description };
}
