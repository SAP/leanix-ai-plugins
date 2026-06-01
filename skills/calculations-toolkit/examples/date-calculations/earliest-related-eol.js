/**
 * Earliest Related EOL
 *
 * Fact Sheet Type: Application
 * Target Field: earliestItcEol (Integer)
 * Logic: Finds the minimum days to EOL across all linked IT components
 *
 * Useful for identifying upcoming technology obsolescence.
 * Returns negative if any ITC is past EOL.
 */

export function main() {
  const relations = data.relApplicationToITComponent ?? [];

  if (relations.length === 0) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysToEol = [];

  for (const rel of relations) {
    const phases = rel.factsheet?.lifecycle?.phases ?? [];
    const eolPhase = phases.find(p => p.phase === "endOfLife");

    if (eolPhase?.startDate) {
      const eolDate = new Date(eolPhase.startDate);
      eolDate.setHours(0, 0, 0, 0);
      const days = Math.floor((eolDate - today) / (1000 * 60 * 60 * 24));
      daysToEol.push(days);
    }
  }

  if (daysToEol.length === 0) {
    return null;  // No ITCs have EOL dates
  }

  return Math.min(...daysToEol);
}
