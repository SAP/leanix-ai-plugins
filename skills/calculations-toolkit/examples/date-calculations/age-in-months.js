/**
 * Age in Months
 *
 * Fact Sheet Type: Application
 * Target Field: ageInMonths (Integer)
 * Logic: Calculates how many months since the fact sheet was created
 */

export function main() {
  if (!data.createdAt) {
    return null;
  }

  const today = new Date();
  const created = new Date(data.createdAt);

  const yearDiff = today.getFullYear() - created.getFullYear();
  const monthDiff = today.getMonth() - created.getMonth();

  return yearDiff * 12 + monthDiff;
}
