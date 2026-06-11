/**
 * Minimum Days to EOL
 *
 * Fact Sheet Type: Application
 * Target Field: minDaysToEol (Integer)
 * Logic: Returns the minimum days until EOL across all linked ITCs
 *
 * Returns negative values for ITCs past their EOL date.
 */

export function main() {
  const relations = data.relApplicationToITComponent ?? [];

  if (relations.length === 0) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysToEol = relations
    .map(r => {
      const phases = r.factsheet?.lifecycle?.phases ?? [];
      const eolPhase = phases.find(p => p.phase === "endOfLife");

      if (!eolPhase?.startDate) {
        return null;
      }

      const eolDate = new Date(eolPhase.startDate);
      eolDate.setHours(0, 0, 0, 0);

      return Math.floor((eolDate - today) / (1000 * 60 * 60 * 24));
    })
    .filter(d => d != null);

  if (daysToEol.length === 0) {
    return null;
  }

  return Math.min(...daysToEol);
}
