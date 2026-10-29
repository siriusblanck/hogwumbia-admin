export function databaseErrorMessage(error: { code?: string } | null, singular: string, mode: "save" | "delete"): string {
  const code = error?.code;
  if (code === "23505") return `A ${singular} with that value already exists.`;
  if (code === "23503") {
    return mode === "save"
      ? "A linked record no longer exists. Choose another and try again."
      : `This ${singular} is still used by other records. Remove or reassign those first.`;
  }
  if (code === "23514" || code === "23502" || code === "22001") return "One of the values isn't allowed. Check the limits and try again.";
  return mode === "save" ? `The ${singular} couldn't be saved. Try again.` : `The ${singular} couldn't be deleted. Try again.`;
}
