/**
 * Weighted Average Score
 *
 * Fact Sheet Type: Application
 * Target Field: weightedScore (Double)
 * Logic: Calculates weighted average using userCount as weight
 *
 * Each user group's score contributes proportionally to its size.
 *
 * Configuration:
 *   - SCORE_FIELD: Field containing the score
 *   - WEIGHT_FIELD: Field containing the weight
 */

export function main() {
  const SCORE_FIELD = "satisfactionScore";
  const WEIGHT_FIELD = "userCount";

  const relations = data.relApplicationToUserGroup ?? [];

  if (relations.length === 0) {
    return null;
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const rel of relations) {
    const score = rel.factsheet?.[SCORE_FIELD];
    const weight = rel.factsheet?.[WEIGHT_FIELD];

    if (typeof score === "number" && typeof weight === "number" && weight > 0) {
      weightedSum += score * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) {
    return null;
  }

  const weightedAvg = weightedSum / totalWeight;

  // Round to 2 decimal places
  return Math.round(weightedAvg * 100) / 100;
}
