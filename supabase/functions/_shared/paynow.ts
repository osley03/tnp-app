export type PaynowFields = Array<[string, string]>;
export function parsePaynow(text: string): PaynowFields {
  if (text.length > 32768) throw new Error("Provider response is too large");
  const fields: PaynowFields = [];
  const names = new Set<string>();
  for (const [key, value] of new URLSearchParams(text)) {
    const name = key.toLowerCase();
    if (names.has(name)) throw new Error("Duplicate provider field");
    names.add(name); fields.push([name, value]);
  }
  return fields;
}
export function field(fields: PaynowFields, name: string): string {
  return fields.find(([key]) => key === name)?.[1] || "";
}
export async function sha512(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}
export async function signPaynow(fields: PaynowFields, key: string): Promise<string> {
  return sha512(fields.filter(([name]) => name.toLowerCase() !== "hash").map(([, value]) => value).join("") + key);
}
export async function verifyPaynow(fields: PaynowFields, key: string): Promise<void> {
  const received = field(fields, "hash").toUpperCase();
  if (!/^[A-F0-9]{128}$/.test(received)) throw new Error("Invalid provider signature");
  const expected = await signPaynow(fields, key);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  if (difference) throw new Error("Invalid provider signature");
}
export function moneyCents(value: string | number): number {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error("Use a positive amount with at most two decimal places");
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100000000) throw new Error("Invalid payment amount");
  return cents;
}
export function paynowUrl(value: string, kind: "checkout" | "poll"): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "www.paynow.co.zw" || url.port || url.username || url.password || url.hash)
    throw new Error("Invalid provider URL");
  if (kind === "poll" && (!/^\/interface\/checkpayment\/?$/i.test(url.pathname) || !url.searchParams.get("guid")))
    throw new Error("Invalid provider polling URL");
  if (kind === "checkout" && !/^\/payment\//i.test(url.pathname)) throw new Error("Invalid provider checkout URL");
  return url.href;
}
export function paymentState(status: string): "pending" | "paid" | "cancelled" | "disputed" | "refunded" {
  switch (status.toLowerCase()) {
    case "paid": case "awaiting delivery": case "delivered": return "paid";
    case "created": case "sent": return "pending";
    case "cancelled": return "cancelled";
    case "disputed": return "disputed";
    case "refunded": return "refunded";
    default: throw new Error("Unrecognised provider payment status");
  }
}
