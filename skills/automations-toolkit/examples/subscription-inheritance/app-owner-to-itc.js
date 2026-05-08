/**
 * Application Owner to ITComponent - Full Reconciliation
 *
 * Triggers (on Application): Subscription Added, Subscription Removed, Relation Added
 * Logic: Syncs "Application Owner" subscriptions from Application to related ITComponents
 */

export async function main() {
  const appId = data?.factSheet?.id;
  if (!appId || data?.factSheet?.type !== "Application") return {};

  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  const graphqlUrl = "https://INSTANCE.leanix.net/services/pathfinder/v1/graphql";

  const query = `query ($id: ID!) {
    factSheet(id: $id) {
      id
      name
      subscriptions { edges { node { type user { id } roles { id name } } } }
      ... on Application {
        relApplicationToITComponent { edges { node { factSheet {
          id rev subscriptions { edges { node { id type user { id } roles { id name } } } }
        } } } }
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

  // Extract Application Owners
  const owners = new Map();
  for (const sub of (app.subscriptions?.edges || []).map(e => e?.node).filter(Boolean)) {
    if (sub.type !== "RESPONSIBLE") continue;
    for (const role of sub.roles || []) {
      if (role.name === "Application Owner") {
        owners.set(`${role.id}|${sub.user.id}`, { userId: sub.user.id, roleId: role.id });
      }
    }
  }

  const itcs = (app.relApplicationToITComponent?.edges || []).map(e => e?.node?.factSheet).filter(Boolean);
  if (!itcs.length) return {};

  for (const itc of itcs) {
    let currentRev = itc.rev;
    const itcSubs = (itc.subscriptions?.edges || []).map(e => e?.node).filter(Boolean);

    // Find existing Application Owner subscriptions
    const existing = [];
    for (const sub of itcSubs) {
      if (sub.type !== "RESPONSIBLE") continue;
      for (const role of sub.roles || []) {
        if (role.name === "Application Owner") {
          existing.push({ subId: sub.id, key: `${role.id}|${sub.user.id}`, roleId: role.id, roleCount: sub.roles.length });
        }
      }
    }
    const existingKeys = new Set(existing.map(o => o.key));

    // Add missing owners
    for (const [key, owner] of owners) {
      if (existingKeys.has(key)) continue;
      const createRes = await fetch(graphqlUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation ($fsId: ID!, $fsRev: Long!, $user: UserInput!, $roles: [SubscriptionToSubscriptionRoleLinkInput]) {
            createSubscription(factSheetId: $fsId, factSheetRev: $fsRev, user: $user, type: RESPONSIBLE, roles: $roles) { factSheet { rev } }
          }`,
          variables: { fsId: itc.id, fsRev: currentRev, user: { id: owner.userId }, roles: [{ id: owner.roleId, comment: `Inherited from ${app.name}` }] },
        }),
      });
      const createJson = await createRes.json();
      if (createJson?.errors) throw new Error(`Create failed: ${JSON.stringify(createJson.errors)}`);
      currentRev = createJson?.data?.createSubscription?.factSheet?.rev ?? currentRev;
    }

    // Remove owners not in current list
    for (const ex of existing) {
      if (owners.has(ex.key)) continue;
      if (ex.roleCount === 1) {
        await fetch(graphqlUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: `mutation ($id: ID!) { deleteSubscription(id: $id) { id } }`, variables: { id: ex.subId } }),
        });
      } else {
        const sub = itcSubs.find(s => s.id === ex.subId);
        const remainingRoleIds = (sub?.roles || []).map(r => r.id).filter(id => id !== ex.roleId);
        await fetch(graphqlUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: `mutation ($id: ID!, $roleIds: [ID!]) { updateSubscription(id: $id, roleIds: $roleIds) { id } }`, variables: { id: ex.subId, roleIds: remainingRoleIds } }),
        });
      }
    }
  }

  return {};
}
