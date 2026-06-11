/**
 * Data Quality Score
 *
 * Fact Sheet Type: Application
 * Target Field: dataQualityScore (Double)
 * Logic: Weighted quality score based on multiple factors
 *
 * Factors:
 *   - Field completeness (40%)
 *   - Relation coverage (30%)
 *   - Description quality (20%)
 *   - Lifecycle defined (10%)
 *
 * Returns 0-100 score.
 */

export function main() {
  const WEIGHTS = {
    fields: 0.40,
    relations: 0.30,
    description: 0.20,
    lifecycle: 0.10,
  };

  // Factor 1: Field completeness (0-100)
  const requiredFields = [
    data.businessCriticality,
    data.technicalFit,
    data.functionalFit,
  ];
  const filledFields = requiredFields.filter(f => f != null).length;
  const fieldScore = (filledFields / requiredFields.length) * 100;

  // Factor 2: Relation coverage (0-100)
  const requiredRelations = [
    data.relApplicationToBusinessCapability,
    data.relApplicationToITComponent,
    data.relApplicationToUserGroup,
  ];
  const coveredRelations = requiredRelations.filter(
    r => (r ?? []).length > 0
  ).length;
  const relationScore = (coveredRelations / requiredRelations.length) * 100;

  // Factor 3: Description quality (0-100)
  const descLength = (data.description ?? "").length;
  let descScore = 0;
  if (descLength > 500) descScore = 100;
  else if (descLength > 200) descScore = 75;
  else if (descLength > 50) descScore = 50;
  else if (descLength > 0) descScore = 25;

  // Factor 4: Lifecycle defined (0-100)
  const hasLifecycle = data.lifecycle?.currentPhase != null;
  const lifecycleScore = hasLifecycle ? 100 : 0;

  // Weighted total
  const total = (
    fieldScore * WEIGHTS.fields +
    relationScore * WEIGHTS.relations +
    descScore * WEIGHTS.description +
    lifecycleScore * WEIGHTS.lifecycle
  );

  return Math.round(total);
}
