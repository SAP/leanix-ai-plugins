/**
 * Approval Required Check
 *
 * Fact Sheet Type: Application
 * Target Field: approvalRequired (Single Select)
 * Logic: Determines if changes require approval based on criticality and cost
 *
 * Target field options: "executive", "manager", "team_lead", "none"
 */

export function main() {
  const criticality = data.businessCriticality;

  // Calculate total cost from ITCs
  const itcs = data.relApplicationToITComponent ?? [];
  const totalCost = itcs
    .map(r => r.factsheet?.annualCost ?? 0)
    .reduce((sum, cost) => sum + cost, 0);

  // Check user count
  const userGroups = data.relApplicationToUserGroup ?? [];
  const userCount = userGroups
    .map(r => r.factsheet?.userCount ?? 0)
    .reduce((sum, count) => sum + count, 0);

  // Mission critical always needs executive approval
  if (criticality === "missionCritical") {
    return "executive";
  }

  // High cost or many users needs executive
  if (totalCost > 500000 || userCount > 1000) {
    return "executive";
  }

  // Business critical needs manager
  if (criticality === "businessCritical") {
    return "manager";
  }

  // Moderate cost or users needs manager
  if (totalCost > 100000 || userCount > 100) {
    return "manager";
  }

  // Business operational needs team lead
  if (criticality === "businessOperational") {
    return "team_lead";
  }

  // Low criticality, low cost, few users
  if (criticality === "administrativeService" && totalCost < 10000 && userCount < 10) {
    return "none";
  }

  return "team_lead";
}
