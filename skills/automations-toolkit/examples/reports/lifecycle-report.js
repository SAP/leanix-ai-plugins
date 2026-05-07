/**
 * ToDo Creation for Lifecycle Review
 *
 * Trigger: Application Updated
 * Logic: Creates ToDo item for Applications in phaseOut or endOfLife phase (idempotent)
 *
 * IMPORTANT: Replace placeholders before use:
 *   - INSTANCE: Your LeanIX instance name (e.g., "mycompany" for mycompany.leanix.net)
 *   - USER_ID_PLACEHOLDER: UUID of the user to assign the ToDo to
 */

export async function main() {
  const fs = data.factSheet;
  const TODO_TAG = "TODO_CREATED";

  if (fs.type !== "Application" || !fs.lifecycle) return {};

  const phase = fs.lifecycle.phase;
  if (phase !== "phaseOut" && phase !== "endOfLife") return {};

  // Idempotency: Skip if ToDo already created
  if (fs.tags?.includes(TODO_TAG)) {
    return {};
  }

  // Safe secret access with validation
  const token = context?.secrets?.["default_automations_secret"]?.value?.bearerToken;
  if (!token) throw new Error("ABORT AUTOMATION RUN - Missing bearerToken");

  // TODO: Replace INSTANCE with your LeanIX instance name
  const todoUrl = "https://INSTANCE.leanix.net/services/todo/v1/to-do";

  // Calculate due date (90 days from now)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 90);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  const todoRes = await fetch(todoUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      factSheet: { id: fs.id },
      title: "Lifecycle Review Required",
      category: "ACTION_ITEM",
      description: `Fact sheet "${fs.name}" is in ${phase} phase and requires review.`,
      // TODO: Replace USER_ID_PLACEHOLDER with actual user UUID
      assignees: [{ id: "USER_ID_PLACEHOLDER" }],
      dueDate: dueDateStr,
    }),
  });

  if (!todoRes.ok) {
    throw new Error(`Failed to create ToDo: ${todoRes.status}`);
  }

  // Only add tag after successful ToDo creation
  return { tags: [...(fs.tags ?? []), TODO_TAG] };
}
