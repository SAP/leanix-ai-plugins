/**
 * Sum Annual Costs
 *
 * Fact Sheet Type: Application
 * Target Field: totalItcCost (Double)
 * Logic: Sums the annualCost field from all linked IT components
 *
 * Configuration:
 *   - COST_FIELD: Field name on related fact sheet containing cost
 */

export function main() {
  const COST_FIELD = "annualCost";

  const relations = data.relApplicationToITComponent ?? [];

  if (relations.length === 0) {
    return null;
  }

  const total = relations
    .map(r => r.factsheet?.[COST_FIELD] ?? 0)
    .reduce((sum, cost) => sum + cost, 0);

  return total;
}
