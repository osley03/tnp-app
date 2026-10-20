export function reportRuntimeError(error: unknown, context: Record<string, unknown> = {}) {
  console.error("TNP application error", error, context);
}
