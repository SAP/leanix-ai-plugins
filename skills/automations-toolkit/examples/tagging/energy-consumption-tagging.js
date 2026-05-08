/**
 * Energy Consumption T-Shirt Size Tagging
 *
 * Trigger: Field value is changed → EnergyConsumptionLevel (ITComponent)
 * Action: Run Script
 */

// Tag IDs for the "Energy Consumption" tag group
// Replace with your workspace IDs
const TAG_IDS = {
  XS: "00000000-0000-0000-0000-000000000001",
  S: "00000000-0000-0000-0000-000000000002",
  M: "00000000-0000-0000-0000-000000000003",
  L: "00000000-0000-0000-0000-000000000004",
  XL: "00000000-0000-0000-0000-000000000005"
};

const ALL_ENERGY_TAG_IDS = Object.values(TAG_IDS);

export function main() {
  // Get values from fact sheet
  const energyConsumptionLevel = data.factSheet.energyConsumptionLevel;
  const currentTags = data.factSheet.tags ?? [];

  // Determine T-shirt size based on ranges
  let tShirtSize = null;
  if (energyConsumptionLevel != null) {
    if (energyConsumptionLevel >= 100 && energyConsumptionLevel <= 300) {
      tShirtSize = "XS";
    } else if (energyConsumptionLevel <= 700) {
      tShirtSize = "S";
    } else if (energyConsumptionLevel <= 1200) {
      tShirtSize = "M";
    } else if (energyConsumptionLevel <= 2500) {
      tShirtSize = "L";
    } else {
      tShirtSize = "XL";
    }
  }

  const requiredTagId = tShirtSize ? TAG_IDS[tShirtSize] : null;

  // Check if correct tag already applied
  if (requiredTagId && currentTags.includes(requiredTagId)) {
    return {};
  }

  // Remove existing energy tags, keep others
  const otherTags = currentTags.filter(id => !ALL_ENERGY_TAG_IDS.includes(id));

  // Build new tag list
  if (requiredTagId) {
    return { tags: [...otherTags, requiredTagId] };
  }

  return { tags: otherTags };
}
