export function isReviewableLease(status: string): boolean {
  return ["active", "completed", "terminated"].includes(status.trim().toLowerCase());
}
