import { supabase } from "@/integrations/supabase/client";
export type Destination = {
  id: string;
  landlord_id: string;
  method: string;
  account_name: string;
  account_number: string;
  institution: string;
  instructions: string;
  currency: string;
  enabled: boolean;
  created_at: string;
  revision: number;
};
export type Submission = {
  id: string;
  payment_id: string;
  lease_id: string;
  tenant_id: string;
  landlord_id: string;
  tnp_reference: string;
  destination_snapshot: Destination;
  expected_amount_usd: number;
  amount_usd: number;
  paid_on: string;
  transaction_reference: string;
  receipt_path: string;
  receipt_sha256: string;
  flags: string[];
  created_at: string;
};
export type Decision = {
  id: string;
  submission_id: string;
  landlord_id: string;
  decision: "confirmed" | "disputed";
  note: string;
  created_at: string;
};
export type TrailEvent = {
  id: number;
  lease_id: string;
  payload: Record<string, unknown>;
  previous_hash: string;
  entry_hash: string;
  created_at: string;
};
export async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const r = await supabase.rpc(name as never, args as never);
  if (r.error) throw Error(r.error.message);
  return r.data as unknown as T;
}
export async function hashBlob(blob: Blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function prepareReceipt(file: File): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw Error("Choose a JPEG, PNG or WebP screenshot under 10 MB.");
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2000 / image.width, 4000 / image.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Your browser could not prepare this receipt.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (!blob || blob.size > 5 * 1024 * 1024)
      throw Error("Receipt is too large. Export a smaller screenshot.");
    return blob;
  } finally {
    image.close();
  }
}
export async function receiptUrl(path: string) {
  const r = await supabase.storage.from("tnp-manual-receipts").createSignedUrl(path, 120);
  if (r.error) throw Error(r.error.message);
  return r.data.signedUrl;
}
export async function uploadReceipt(user: string, payment: string, id: string, blob: Blob) {
  const path = user + "/" + payment + "/" + id + ".jpg";
  const hash = await hashBlob(blob);
  const r = await supabase.storage
    .from("tnp-manual-receipts")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (r.error) {
    const response = await fetch(await receiptUrl(path));
    if (!response.ok || (await hashBlob(await response.blob())) !== hash)
      throw Error(
        "Receipt upload could not be verified. Check your existing submissions before retrying.",
      );
  }
  return { path, hash };
}
export async function fullTrail(lease: string) {
  const events: TrailEvent[] = [];
  for (let start = 0; ; start += 1000) {
    const r = await supabase
      .from("tnp_manual_payment_events" as never)
      .select("*")
      .eq("lease_id", lease)
      .order("id")
      .range(start, start + 999);
    if (r.error) throw Error(r.error.message);
    const batch = r.data as unknown as TrailEvent[];
    events.push(...batch);
    if (batch.length < 1000) return events;
  }
}
export { csvCell, trailCsv, downloadCsv, escapeHtml, printTrail } from "./exports";
