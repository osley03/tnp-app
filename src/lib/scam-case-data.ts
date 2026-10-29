export function scamText(value: unknown, fallback = ""): string {
  return typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : fallback;
}
export function normalizeScamCase(
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>,
    id = scamText(row["id"]);
  if (!id) return null;
  let evidence: unknown = row["evidence"];
  if (typeof evidence === "string") {
    try {
      const parsed = JSON.parse(evidence);
      evidence = Array.isArray(parsed) ? parsed : [evidence];
    } catch {
      evidence = [evidence];
    }
  }
  const proof = (Array.isArray(evidence) ? evidence : [])
    .filter((item) => item != null)
    .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    .filter(Boolean);
  const result: Record<string, unknown> = {
    ...row,
    id,
    evidence: proof,
    title: scamText(row["title"]).trim() || "Reported scam " + id.slice(0, 8),
    description: scamText(row["description"], "No description was provided."),
    status: scamText(row["status"], "submitted"),
    priority: scamText(row["priority"], "medium"),
    case_type: scamText(row["case_type"], "other"),
  };
  for (const key of [
    "reference",
    "source",
    "reporter_name",
    "reporter_email",
    "reporter_phone",
    "scammer_name",
    "scammer_phone",
    "scammer_email",
    "location",
    "address",
    "identification_number",
    "payment_method",
    "payment_reference",
    "admin_notes",
    "resolution",
  ])
    result[key] = scamText(row[key]) || null;
  return result;
}
export function scamDate(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-ZW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
