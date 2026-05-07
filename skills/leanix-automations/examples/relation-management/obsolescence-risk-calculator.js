/**
 * Obsolescence Risk Status Calculator
 *
 * Trigger: Application Fact Sheet Updated
 * Logic: Sets obsolescenceRiskStatus on Application-to-ITComponent relations
 *   - riskTargetPlan null or riskTargetDate empty → skip
 *   - current date > riskTargetDate OR endOfLife → 'riskAccepted'
 *   - Otherwise → 'riskAddressed'
 */

const GRAPHQL_URL = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

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
  if (!appId) throw new Error("ABORT AUTOMATION RUN - No factSheet ID provided");

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  const graphqlUrl = GRAPHQL_URL;

  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id
      rev
      ... on Application {
        relApplicationToITComponent {
          edges { node {
            id
            factSheet { id ... on ITComponent { lifecycle { phases { phase startDate } } } }
            riskTargetPlan
            riskTargetDate
            obsolescenceRiskStatus
          } }
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

  const relations = (app.relApplicationToITComponent?.edges || []).map(e => e?.node).filter(Boolean);
  if (!relations.length) return {};

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const rel of relations) {
    if (rel.riskTargetPlan == null || !rel.riskTargetDate) continue;

    const eolPhase = (rel.factSheet?.lifecycle?.phases || []).find(p => p.phase === "endOfLife");
    const targetDate = new Date(rel.riskTargetDate + "T00:00:00Z");
    const eolDate = eolPhase?.startDate ? new Date(eolPhase.startDate + "T00:00:00Z") : null;

    const newStatus = (eolDate && today > eolDate) || today > targetDate ? "riskAccepted" : "riskAddressed";
    if (newStatus === rel.obsolescenceRiskStatus) continue;

    // Update with retry on REVISION_CLASH
    let retries = 3;
    while (retries > 0) {
      const currentRev = await getCurrentRev(appId, token);
      if (!currentRev) throw new Error("Could not get Application rev");

      const mutRes = await fetch(graphqlUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation ($id: ID!, $rev: Long!, $patches: [Patch]!) {
            updateFactSheet(id: $id, rev: $rev, patches: $patches, validateOnly: false) { factSheet { rev } }
          }`,
          variables: {
            id: appId,
            rev: currentRev,
            patches: [{ op: "replace", path: `/relApplicationToITComponent/${rel.id}`, value: JSON.stringify({ factSheetId: rel.factSheet.id, obsolescenceRiskStatus: newStatus }) }],
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
