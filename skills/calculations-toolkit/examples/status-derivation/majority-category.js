/**
 * Majority Category
 *
 * Fact Sheet Type: Application
 * Target Field: primaryItcCategory (Single Select)
 * Logic: Returns the most common category from linked ITCs
 *
 * In case of tie, returns the first one encountered.
 *
 * Configuration:
 *   - CATEGORY_FIELD: Field containing the category
 */

export function main() {
  const CATEGORY_FIELD = "category";

  const relations = data.relApplicationToITComponent ?? [];

  if (relations.length === 0) {
    return null;
  }

  const categories = relations
    .map(r => r.factsheet?.[CATEGORY_FIELD])
    .filter(Boolean);

  if (categories.length === 0) {
    return null;
  }

  // Count occurrences
  const counts = {};
  for (const cat of categories) {
    counts[cat] = (counts[cat] || 0) + 1;
  }

  // Find most common
  let maxCount = 0;
  let mostCommon = null;

  for (const [cat, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = cat;
    }
  }

  return mostCommon;
}
