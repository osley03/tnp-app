import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import { field, moneyCents, parsePaynow, paymentState, paynowUrl, signPaynow, verifyPaynow, type PaynowFields } from "../_shared/paynow.ts";

import { paymentAppOrigin, paymentMerchant, type Merchant } from "../_shared/payment-config.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" };
function reply(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function merchantFor(landlord: string): Merchant | null {
  let merchants;
  try { merchants = JSON.parse(Deno.env.get("PAYNOW_LANDLORD_MERCHANTS") || "{}"); }
  catch { throw new Error("Invalid landlord merchant configuration"); }
  const config = merchants?.[landlord];
  if (!config) return null;
  return paymentMerchant(config);
}
function appOrigin(merchant: Merchant): string { return paymentAppOrigin(Deno.env.get("TNP_APP_URL"), merchant.mode); }

function checkEnabled(merchant: Merchant) {
  if (Deno.env.get("PAYMENT_GATEWAY_ENABLED") !== "true") throw new Error("Online checkout is not enabled yet. No payment has been taken.");
  if (merchant.mode === "live" && Deno.env.get("PAYNOW_LIVE_ENABLED") !== "true") throw new Error("Live payments are not enabled. No payment has been taken.");
}
async function providerRequest(url: string, fields?: PaynowFields): Promise<PaynowFields> {
  let response;
  try { response = await fetch(url, { method: "POST", redirect: "error", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields || []), signal: AbortSignal.timeout(20000) }); }
  catch { throw new Error("Paynow could not be reached. Check this payment's status before trying to pay again."); }
  if (!response.ok) throw new Error("Paynow could not be reached. Do not pay again until the payment status has been checked.");
  return parsePaynow(await response.text());
}
function publicAttempt(attempt: Record<string, unknown>) {
  return { id: attempt.id, paymentId: attempt.payment_id, status: attempt.status, method: attempt.method, mode: attempt.mode, providerReference: attempt.provider_reference || null, lastCheckedAt: attempt.last_checked_at || null };
}
Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL"), secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !secret) return reply({ error: "Payment service is not configured" }, 503);
  const admin = createClient(supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  try {
    const url = new URL(request.url);
    const text = await request.text();
    if (text.length > 32768) return reply({ error: "Request too large" }, 413);
    const webhookId = url.searchParams.get("attempt");
    async function reconcile(attempt: any, merchant: Merchant, callback?: PaynowFields) {
      if (merchant.integrationId !== attempt.integration_id || merchant.mode !== attempt.mode) throw new Error("Merchant configuration changed; restore this integration before checking the payment.");
      if (callback) {
        await verifyPaynow(callback, merchant.integrationKey);
        if (field(callback, "reference") !== attempt.merchant_reference || moneyCents(field(callback, "amount")) !== moneyCents(attempt.amount_usd)) throw new Error("Payment callback does not match this checkout");
      }
      if (!attempt.poll_url) throw new Error("Checkout is still being prepared. Retry status verification shortly; do not create another payment.");
      // A callback is only a signal to poll our saved provider URL, never proof of payment itself.
      const result = await providerRequest(paynowUrl(attempt.poll_url, "poll"));
      await verifyPaynow(result, merchant.integrationKey);
      if (field(result, "reference") !== attempt.merchant_reference || moneyCents(field(result, "amount")) !== moneyCents(attempt.amount_usd)) throw new Error("Provider amount or reference does not match this payment");
      if (field(result, "pollurl") && paynowUrl(field(result, "pollurl"), "poll") !== paynowUrl(attempt.poll_url, "poll")) throw new Error("Provider polling reference mismatch");
      paymentState(field(result, "status"));
      const confirmation = await admin.rpc("tnp_confirm_gateway_payment", {
        p_attempt_id: attempt.id, p_provider_reference: field(result, "paynowreference"), p_provider_status: field(result, "status"),
        p_amount_usd: field(result, "amount"), p_fingerprint: field(result, "hash").toUpperCase(),
      });
      if (confirmation.error) throw new Error(confirmation.error.message);
      return confirmation.data;
    }
    if (webhookId) {
      if (!uuid.test(webhookId)) return reply({ error: "Invalid callback" }, 400);
      const lookup = await admin.from("tnp_gateway_attempts").select("*").eq("id", webhookId).single();
      if (lookup.error || !lookup.data) return reply({ error: "Unknown checkout" }, 404);
      const merchant = merchantFor(lookup.data.landlord_id);
      if (!merchant) return reply({ error: "Merchant unavailable" }, 503);
      await reconcile(lookup.data, merchant, parsePaynow(text));
      return reply({ received: true });
    }
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Sign in required" }, 401);
    const auth = await admin.auth.getUser(token);
    if(auth.data.user){const closed=await admin.from('tnp_deleted_accounts').select('account_id').eq('account_id',auth.data.user.id).maybeSingle();if(closed.error||closed.data)return reply({error:'Account is unavailable'},403);}
    if (auth.error || !auth.data.user) return reply({ error: "Sign in required" }, 401);
    const user = auth.data.user;
    const body = JSON.parse(text);
    if (body.action === "merchant-status") {
      const roles = await admin.from("user_roles").select("role").eq("user_id", user.id);
      if (roles.error || !roles.data?.some(row => row.role === "landlord")) return reply({ error: "Landlord sign-in required" }, 403);
      const merchant = merchantFor(user.id);
      let enabled = false; try { if (merchant) { checkEnabled(merchant); appOrigin(merchant); enabled = true; } } catch { /* Keep checkout visibly unavailable. */ }
      return reply({ configured: !!merchant, enabled, mode: merchant?.mode || null, currency: merchant?.currency || "USD" });
    }
    if (!uuid.test(String(body.paymentId || ""))) return reply({ error: "Select a payment request" }, 400);
    const paymentResult = await admin.from("lease_payments").select("*").eq("id", body.paymentId).single();
    const payment = paymentResult.data;
    if (paymentResult.error || !payment || payment.payer_id !== user.id) return reply({ error: "Payment not found or access denied" }, 403);
    const merchant = merchantFor(payment.payee_id);
    if (body.action === "availability") {
      let enabled = false;
      try { if (merchant) { checkEnabled(merchant); appOrigin(merchant); enabled = true; } } catch { /* Unconfigured checkouts remain unavailable. */ }
      return reply({ configured: !!merchant, enabled, mode: merchant?.mode || null, currency: "USD" });
    }
    if (!merchant) return reply({ error: "This landlord has not connected their Paynow merchant account. No payment has been taken." }, 409);
    if (body.action === "checkout") {
      checkEnabled(merchant);
      const origin = appOrigin(merchant);
      if (!["ecocash", "mastercard"].includes(body.method)) return reply({ error: "Choose EcoCash or Mastercard" }, 400);
      const claim = crypto.randomUUID();
      const reservation = await admin.rpc("tnp_reserve_gateway_payment", { p_payment_id: payment.id, p_payer_id: user.id, p_method: body.method,
        p_integration_id: merchant.integrationId, p_mode: merchant.mode, p_claim_token: claim });
      if (reservation.error) throw new Error(reservation.error.message);
      let attempt = reservation.data;
      if (attempt.claim_token !== claim) {
        if (attempt.integration_id !== merchant.integrationId || attempt.mode !== merchant.mode) throw new Error("Merchant changed. Contact TNP before retrying payment.");
        if (attempt.status === "pending" && attempt.browser_url) return reply({ ...publicAttempt(attempt), checkoutUrl: paynowUrl(attempt.browser_url, "checkout") });
        return reply({ ...publicAttempt(attempt), message: "An attempt already exists. Check its status; do not create another payment for the same amount." });
      }
      const returnUrl = new URL("/app/tenant/payments", origin); returnUrl.searchParams.set("payment", payment.id);
      const callback = new URL("/functions/v1/payment-gateway", supabaseUrl); callback.searchParams.set("attempt", attempt.id);
      const fields: PaynowFields = [["id", merchant.integrationId], ["reference", attempt.merchant_reference], ["amount", (moneyCents(attempt.amount_usd) / 100).toFixed(2)],
        ["additionalinfo", "TNP lease " + payment.payment_type + " payment"], ["returnurl", returnUrl.href], ["resulturl", callback.href],
        ["authemail", merchant.mode === "test" ? merchant.testEmail || "" : user.email || ""], ["merchanttrace", attempt.id.replaceAll("-", "")], ["status", "Message"]];
      fields.push(["hash", await signPaynow(fields, merchant.integrationKey)]);
      const result = await providerRequest("https://www.paynow.co.zw/interface/initiatetransaction", fields);
      if (field(result, "status").toLowerCase() !== "ok") throw new Error("Paynow did not create checkout. Contact support with your TNP payment reference before retrying.");
      await verifyPaynow(result, merchant.integrationKey);
      const browserUrl = paynowUrl(field(result, "browserurl"), "checkout");
      const pollUrl = paynowUrl(field(result, "pollurl"), "poll");
      const updated = await admin.from("tnp_gateway_attempts").update({ status: "pending", browser_url: browserUrl, poll_url: pollUrl,
        provider_reference: field(result, "paynowreference") || null, updated_at: new Date().toISOString() }).eq("id", attempt.id).eq("status", "creating").select("*").single();
      if (updated.error) throw new Error("Checkout was created but could not be saved. Contact support; do not start another payment.");
      attempt = updated.data;
      return reply({ ...publicAttempt(attempt), checkoutUrl: browserUrl });
    }
    if (body.action === "verify") {
      const attempts = await admin.from("tnp_gateway_attempts").select("*").eq("payment_id", payment.id).order("created_at", { ascending: false }).limit(1);
      if (attempts.error || !attempts.data?.[0]) return reply({ error: "No checkout has been started for this payment" }, 404);
      const attempt = attempts.data[0];
      // Limit tenant-triggered polling; signed provider callbacks remain available.
      if (attempt.last_checked_at && Date.now() - Date.parse(attempt.last_checked_at) < 5000) return reply({ ...publicAttempt(attempt), message: "Please wait a few seconds before checking again." });
      const slot = await admin.from("tnp_gateway_attempts").update({ last_checked_at: new Date().toISOString() }).eq("id", attempt.id)
        .or("last_checked_at.is.null,last_checked_at.lt." + new Date(Date.now() - 5000).toISOString()).select("id").single();
      if (slot.error || !slot.data) return reply({ ...publicAttempt(attempt), message: "Please wait a few seconds before checking again." });
      const evidence = await reconcile(attempt, merchant);
      return reply({ id: attempt.id, paymentId: payment.id, status: evidence.payment_status, mode: attempt.mode, evidenceId: evidence.id,
        message: attempt.mode === "test" ? "TEST transaction only. No live rent or deposit has been recorded as paid." : "Status verified with Paynow. Settlement follows the landlord's merchant agreement." });
    }
    return reply({ error: "Unknown payment action" }, 400);
  } catch (cause) {
    // No credentials, callback body, poll URL or card details in logs.
    const message = cause instanceof Error ? cause.message : "Payment service unavailable";
    return reply({ error: message }, 400);
  }
});
