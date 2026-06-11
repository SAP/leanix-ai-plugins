/**
 * Days to End of Life
 *
 * Fact Sheet Type: Application
 * Target Field: daysToEol (Integer)
 * Logic: Calculates days until the End of Life phase
 *
 * Returns negative values if EOL date is in the past.
 * Returns null if no EOL date is set.
 */

export function main() {
  const phases = data.lifecycle?.phases ?? [];
  const eolPhase = phases.find(p => p.phase === "endOfLife");

  if (!eolPhase?.startDate) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eolDate = new Date(eolPhase.startDate);
  eolDate.setHours(0, 0, 0, 0);

  const diffMs = eolDate - today;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
