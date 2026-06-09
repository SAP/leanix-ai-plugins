/**
 * Display Label
 *
 * Fact Sheet Type: Application
 * Target Field: displayLabel (String)
 * Logic: Creates a formatted label from name, version, and lifecycle
 *
 * Example output: "MyApp v2.1 (Active)"
 */

export function main() {
  const name = data.name ?? "Unknown";
  const version = data.version;
  const phase = data.lifecycle?.currentPhase;

  const parts = [name];

  if (version) {
    parts.push(`v${version}`);
  }

  if (phase) {
    // Capitalize first letter
    const displayPhase = phase.charAt(0).toUpperCase() + phase.slice(1);
    parts.push(`(${displayPhase})`);
  }

  return parts.join(" ");
}
