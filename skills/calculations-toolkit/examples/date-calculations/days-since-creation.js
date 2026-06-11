/**
 * Days Since Creation
 *
 * Fact Sheet Type: Application
 * Target Field: ageInDays (Integer)
 * Logic: Calculates how many days since the fact sheet was created
 */

export function main() {
  if (!data.createdAt) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const created = new Date(data.createdAt);
  created.setHours(0, 0, 0, 0);

  const diffMs = today - created;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
