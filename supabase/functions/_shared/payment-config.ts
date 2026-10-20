export type Merchant = { integrationId: string; integrationKey: string; currency: "USD"; mode: "test" | "live"; testEmail?: string };
export function paymentAppOrigin(value: string | undefined, mode: "test" | "live"): string {
  let url: URL; try { url = new URL(value || ""); } catch { throw new Error("Configure TNP_APP_URL before enabling checkout"); }
  const host = url.hostname.toLowerCase();
  const local = host === "localhost" || host.endsWith(".localhost") || host === "[::1]" || /^127\./.test(host);
  const privateHost = local || host.endsWith(".local") || !host.includes(".") || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":");
  if (url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname) || (url.protocol !== "https:" && !(mode === "test" && url.protocol === "http:" && local))) throw new Error("Use an application origin without a path, credentials or query");
  if (mode === "live" && (url.protocol !== "https:" || privateHost)) throw new Error("Live payments require TNP's public HTTPS website address; localhost cannot receive live returns");
  return url.origin;
}
export function paymentMerchant(config: unknown): Merchant {
  const item = config as Partial<Merchant> | null;
  if (!item || !/^\d+$/.test(String(item.integrationId)) || typeof item.integrationKey !== "string" || item.integrationKey.trim().length < 16 || item.currency !== "USD" || !["test", "live"].includes(item.mode || "")) throw new Error("Invalid landlord merchant configuration");
  if (item.mode === "test" && (typeof item.testEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.testEmail))) throw new Error("Configure the landlord's Paynow merchant test email before testing checkout");
  return { ...item, integrationId: String(item.integrationId) } as Merchant;
}
export function validatePaymentSetup(env: Record<string, string | undefined>) {
  if (!["true", "false"].includes(env.PAYMENT_GATEWAY_ENABLED || "") || !["true", "false"].includes(env.PAYNOW_LIVE_ENABLED || "")) throw new Error("Set both payment enable flags explicitly to true or false");
  let mapping: unknown; try { mapping = JSON.parse(env.PAYNOW_LANDLORD_MERCHANTS || ""); } catch { throw new Error("PAYNOW_LANDLORD_MERCHANTS must be valid JSON on one line"); }
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) throw new Error("Merchant mapping must be an object keyed by landlord Auth UUID");
  const seen = new Set<string>(); let live = 0, test = 0;
  for (const [id, value] of Object.entries(mapping)) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Merchant mapping requires actual landlord Auth UUID keys");
    const merchant = paymentMerchant(value); paymentAppOrigin(env.TNP_APP_URL, merchant.mode);
    if (seen.has(merchant.integrationId)) throw new Error("Each landlord must have a separate receiving merchant integration");
    seen.add(merchant.integrationId); merchant.mode === "live" ? live++ : test++;
  }
  if (!live && !test && env.PAYMENT_GATEWAY_ENABLED === "true") throw new Error("Cannot enable checkout without a receiving landlord merchant");
  if (env.PAYNOW_LIVE_ENABLED === "true" && (!live || env.PAYMENT_GATEWAY_ENABLED !== "true")) throw new Error("Live activation requires a live merchant and enabled gateway");
  paymentAppOrigin(env.TNP_APP_URL, env.PAYNOW_LIVE_ENABLED === "true" ? "live" : "test");
  return { liveMerchants: live, testMerchants: test, checkoutEnabled: env.PAYMENT_GATEWAY_ENABLED === "true", liveEnabled: env.PAYNOW_LIVE_ENABLED === "true" };
}
