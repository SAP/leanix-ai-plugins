/**
 * Average Rating
 *
 * Fact Sheet Type: Application
 * Target Field: avgProviderRating (Double)
 * Logic: Calculates average numeric rating from related providers
 *
 * Configuration:
 *   - RELATION_NAME: Relation to providers
 *   - RATING_FIELD: Numeric field to average
 */

export function main() {
  const RELATION_NAME = "relApplicationToProvider";
  const RATING_FIELD = "qualityScore";

  const relations = data[RELATION_NAME] ?? [];

  if (relations.length === 0) {
    return null;
  }

  const values = relations
    .map(r => r.factsheet?.[RATING_FIELD])
    .filter(v => typeof v === "number");

  if (values.length === 0) {
    return null;
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;

  // Round to 2 decimal places
  return Math.round(avg * 100) / 100;
}
