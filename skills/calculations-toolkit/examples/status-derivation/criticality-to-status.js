/**
 * Criticality to Status Mapping
 *
 * Fact Sheet Type: Application
 * Target Field: supportLevel (Single Select)
 * Logic: Maps businessCriticality to a support level status
 *
 * Target field options: "premium", "standard", "basic"
 *
 * Configuration:
 *   - SOURCE_FIELD: Field to map from
 *   - MAPPING: Adjust mapping values
 */

export function main() {
  const SOURCE_FIELD = "businessCriticality";

  const MAPPING = {
    missionCritical: "premium",
    businessCritical: "premium",
    businessOperational: "standard",
    administrativeService: "basic",
  };

  const sourceValue = data[SOURCE_FIELD];

  if (!sourceValue) {
    return null;
  }

  return MAPPING[sourceValue] ?? "basic";
}
