/**
 * Best Case Rating (from Providers)
 *
 * Fact Sheet Type: Application
 * Target Field: bestProviderRating (Single Select)
 * Logic: Returns the best rating from all linked providers
 *
 * Target field options: "platinum", "gold", "silver", "bronze"
 *
 * Priority (best to worst): platinum > gold > silver > bronze
 */

export function main() {
  const relations = data.relApplicationToProvider ?? [];

  if (relations.length === 0) {
    return null;
  }

  const ratings = relations
    .map(r => r.factsheet?.rating)
    .filter(Boolean);

  if (ratings.length === 0) {
    return null;
  }

  // Check in priority order (best first)
  const priority = ["platinum", "gold", "silver", "bronze"];

  for (const rating of priority) {
    if (ratings.includes(rating)) {
      return rating;
    }
  }

  return null;
}
