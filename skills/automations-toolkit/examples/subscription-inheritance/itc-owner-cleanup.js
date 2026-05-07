/**
 * ITComponent Owner Cleanup
 *
 * Trigger: Relation Removed (on ITComponent)
 * Logic: Reconciles "Application Owner" subscriptions based on remaining related Applications
 */

export async function main() {
  const itcId = data?.factSheet?.id;
  if (!itcId || data?.factSheet?.type !== "ITComponent") return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  const graphqlUrl = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id rev
      subscriptions { edges { node { id type user { id } roles { id name } } } }
      ... on ITComponent {
        relITComponentToApplication { edges { node { factSheet {
          subscriptions { edges { node { type user { id } roles { id name } } } }
        } } } }
      }
    }
  }`;

  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: itcId } }),
  });

  const json = await res.json();
  if (json?.errors) throw new Error(`GraphQL failed: ${JSON.stringify(json.errors)}`);

  const itc = json?.data?.factSheet;
  if (!itc) throw new Error("ABORT AUTOMATION RUN - ITComponent not found");

  // Collect desired owners from related Applications
  const desiredOwners = new Map();
  const apps = (itc.relITComponentToApplication?.edges || []).map(e => e?.node?.factSheet).filter(Boolean);
  for (const app of apps) {
    for (const sub of (app.subscriptions?.edges || []).map(e => e?.node).filter(Boolean)) {
      if (sub.type !== "RESPONSIBLE") continue;
      for (const role of sub.roles || []) {
        if (role.name === "Application Owner") {
          desiredOwners.set(`${role.id}|${sub.user.id}`, { userId: sub.user.id, roleId: role.id });
        }
      }
    }
  }

  const itcSubs = (itc.subscriptions?.edges || []).map(e => e?.node).filter(Boolean);
  let currentRev = itc.rev;

  // Find existing Application Owner subscriptions
  const existing = [];
  for (const sub of itcSubs) {
    if (sub.type !== "RESPONSIBLE") continue;
    for (const role of sub.roles || []) {
      if (role.name === "Application Owner") {
        existing.push({ subId: sub.id, key: `${role.id}|${sub.user.id}`, roleId: role.id, roles: sub.roles });
      }
    }
  }
  const existingKeys = new Set(existing.map(s => s.key));

  // Add missing owners
  for (const [key, owner] of desiredOwners) {
    if (existingKeys.has(key)) continue;
    const mutRes = await fetch(graphqlUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation ($fsId: ID!, $fsRev: Long!, $user: UserInput!, $roles: [SubscriptionToSubscriptionRoleLinkInput]) {
          createSubscription(factSheetId: $fsId, factSheetRev: $fsRev, user: $user, type: RESPONSIBLE, roles: $roles) { factSheet { rev } }
        }`,
        variables: { fsId: itcId, fsRev: currentRev, user: { id: owner.userId }, roles: [{ id: owner.roleId, comment: "Inherited from Application" }] },
      }),
    });
    const mutJson = await mutRes.json();
    if (mutJson?.errors) throw new Error(`Create failed: ${JSON.stringify(mutJson.errors)}`);
    currentRev = mutJson?.data?.createSubscription?.factSheet?.rev ?? currentRev;
  }

  // Remove subscriptions not in desired list
  for (const ex of existing) {
    if (desiredOwners.has(ex.key)) continue;
    if (ex.roles.length === 1) {
      await fetch(graphqlUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: `mutation ($id: ID!) { deleteSubscription(id: $id) { id } }`, variables: { id: ex.subId } }),
      });
    } else {
      const remainingRoleIds = ex.roles.map(r => r.id).filter(id => id !== ex.roleId);
      await fetch(graphqlUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: `mutation ($id: ID!, $roleIds: [ID!]) { updateSubscription(id: $id, roleIds: $roleIds) { id } }`, variables: { id: ex.subId, roleIds: remainingRoleIds } }),
      });
    }
  }

  return {};
}
