/**
 * Collect Provider Types
 *
 * Fact Sheet Type: Application
 * Target Field: providerTypes (Multiple Select)
 * Logic: Collects unique provider types from linked providers
 *
 * Target field options should include: "cloud", "onPremise", "hybrid", etc.
 *
 * Configuration:
 *   - TYPE_FIELD: Field containing the provider type
 */

export function main() {
  const TYPE_FIELD = "providerType";

  const relations = data.relApplicationToProvider ?? [];

  if (relations.length === 0) {
    return null;
  }

  const types = relations
    .map(r => r.factsheet?.[TYPE_FIELD])
    .filter(Boolean);

  if (types.length === 0) {
    return null;
  }

  // Return unique values
  return [...new Set(types)];
}
