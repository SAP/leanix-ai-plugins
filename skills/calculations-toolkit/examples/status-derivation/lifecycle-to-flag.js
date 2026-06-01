/**
 * Lifecycle to Flag
 *
 * Fact Sheet Type: Application
 * Target Field: lifecycleFlag (Single Select)
 * Logic: Converts lifecycle phase to a simple flag
 *
 * Target field options: "active", "transitioning", "deprecated"
 */

export function main() {
  const phase = data.lifecycle?.phaseName;

  if (!phase) {
    return null;
  }

  const MAPPING = {
    plan: "transitioning",
    phaseIn: "transitioning",
    active: "active",
    phaseOut: "deprecated",
    endOfLife: "deprecated",
  };

  return MAPPING[phase] ?? null;
}
