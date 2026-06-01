/**
 * Collect ITC Categories
 *
 * Fact Sheet Type: Application
 * Target Field: itcCategories (Multiple Select)
 * Logic: Collects unique categories from linked IT components
 *
 * Target field options should include: "software", "hardware", "service", etc.
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

  // Return unique values
  return [...new Set(categories)];
}
