import { useEffect, useRef, useState } from "react";
import { gateway, type GatewayReply } from "./api";
import { PaymentEvidence } from "./PaymentEvidence";

type Payment = { id: string; reference: string | null; status: string; payment_type: string; amount_usd: string | number; label?: string };
export function GatewayCheckout({ payments, onRefresh, selectedPaymentId, onSelectPayment }: { payments: Payment[]; onRefresh: () => Promise<void>; selectedPaymentId?: string; onSelectPayment?: (id:string)=>void }) {
  const [selected, setSelected] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("payment") || "");
  useEffect(() => { if (selectedPaymentId && payments.some(item => item.id === selectedPaymentId)) setSelected(selectedPaymentId); }, [selectedPaymentId, payments]);
  const [method, setMethod] = useState("ecocash");
  const [portalOpen, setPortalOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("payment"));
  const [verifiedStatus, setVerifiedStatus] = useState("");
  const portalRef = useRef<HTMLDivElement>(null);
  const checkedReturn = useRef(false);
  function openPortal(value: string) {
    setMethod(value); setPortalOpen(true);
    requestAnimationFrame(() => { portalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); portalRef.current?.focus({ preventScroll: true }); });
  }
  const [availability, setAvailability] = useState<GatewayReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const payment = payments.find(item => item.id === selected);
  useEffect(() => {
    if (!payments.some(item => item.id === selected) && payments[0]) { const id = payments.find(item => item.status === "pending")?.id || payments[0].id; setSelected(id); onSelectPayment?.(id); }
  }, [payments, selected]);
  useEffect(() => {
    let active = true; setAvailability(null); setError(""); setNotice(""); setVerifiedStatus("");
    if (selected) void gateway("availability", selected).then(data => { if (active) setAvailability(data); }).catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [selected]);
  async function action(checkout: boolean) {
    if (!payment || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await gateway(checkout ? "checkout" : "verify", payment.id, method);
      if (checkout && result.checkoutUrl) {
        const url = new URL(result.checkoutUrl);
        if (url.protocol !== "https:" || url.hostname !== "www.paynow.co.zw" || url.username || url.password || url.port) throw new Error("Invalid checkout destination");
        window.location.assign(url.href); return;
      }
      setNotice(result.message || "Provider status: " + result.status);
      if (!checkout) setVerifiedStatus(result.status || "");
      setRefresh(value => value + 1); await onRefresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Payment could not be verified. Do not pay again until its status is checked."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const returnedPayment = new URLSearchParams(window.location.search).get("payment");
    if (!checkedReturn.current && !busy && availability?.configured && payment?.id === returnedPayment) {
      checkedReturn.current = true;
      void action(false);
    }
  }, [availability, payment?.id, busy]);
  return <div className="my-6">
    <section className="tnp-payment-paper rounded-2xl border border-blue-200 bg-white p-5 text-slate-950">
      <h2 className="text-xl font-bold">Pay your landlord</h2>
      <p className="mt-2 text-sm text-slate-600">Select an approved rent or deposit request, choose EcoCash or Mastercard, and continue to Paynow’s secure checkout. Payment goes directly to the landlord’s connected merchant account. Application fees are excluded.</p>
        <fieldset disabled={busy} className="mt-5 grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-sm font-semibold">Choose how to pay</legend>
          {([["ecocash", "EcoCash"], ["mastercard", "Mastercard"]] as const).map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-white px-4 py-4 text-sm font-semibold"><input type="radio" aria-label={label} name="gateway-method" value={value} checked={method === value} onClick={() => openPortal(value)} onChange={() => openPortal(value)} />{label}<span className="ml-auto text-xs">Open payment details →</span></label>)}
        </fieldset>
      {!payments.length ? <p role="status" className="mt-4 text-sm">Your rent and deposit requests appear automatically after landlord approval. Choose a request once it appears to open payment details and checkout. No payment is due through this screen yet.</p> : <>
        <label className="mt-4 block text-sm font-semibold">Payment request
          <select className="mt-2 w-full rounded-xl border bg-white p-3" value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); onSelectPayment?.(event.target.value); setNotice(""); }}>
            <option value="">Choose a payment</option>{payments.map(item => <option key={item.id} value={item.id}>{item.label || item.payment_type} · USD {Number(item.amount_usd).toFixed(2)} · {item.status} · {item.reference || item.id}</option>)}
          </select>
        </label>
        {!portalOpen && <button type="button" onClick={() => openPortal(method)} className="mt-4 rounded-xl border px-4 py-3 text-sm font-semibold">Open payment details</button>}
        <div ref={portalRef} tabIndex={-1} hidden={!portalOpen} role="region" aria-label="Payment portal" className="mt-5 scroll-mt-6 rounded-xl border border-blue-200 bg-white p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">
        <h3 className="text-lg font-bold">{method === "ecocash" ? "EcoCash" : "Mastercard"} payment portal</h3>
        <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-3" aria-label="Payment steps"><li>1. Review your payment</li><li>2. Complete secure checkout</li><li>3. Confirm & download receipt</li></ol>
        {payment && <dl className="my-4 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm"><div><dt className="font-semibold">Property / charge</dt><dd className="break-words">{payment.label || payment.payment_type}</dd></div><div><dt className="font-semibold">Amount to pay</dt><dd className="text-2xl font-bold">USD {Number(payment.amount_usd).toFixed(2)}</dd></div><div><dt className="font-semibold">Payment reference</dt><dd className="break-all">{payment.reference || payment.id}</dd></div><div><dt className="font-semibold">Current status</dt><dd>{payment.status}</dd></div></dl>}
        <h4 className="font-semibold">What you need</h4>
        <p className="mt-2 text-sm">{method === "ecocash" ? "Have your EcoCash registered phone available and enough balance for the amount and any provider charges. Choose EcoCash on Paynow and follow its wallet approval instructions. Enter your PIN only through EcoCash’s official approval channel." : "Have a Mastercard enabled for online payments and access to your bank’s verification messages. Choose the card option on Paynow and enter your card details only on its secure payment page. Complete your bank’s approval if requested."}</p>
        <p className="mt-2 text-sm">Review any fees and the final total on the provider page before approving. Availability of each method depends on the landlord’s Paynow merchant account.</p>
        <p className="mt-2 text-xs text-slate-600">You select the final payment method on Paynow's secure page. TNP never requests your card number, CVV or EcoCash PIN.</p>
        {!availability && !error && <p role="status" className="mt-3 text-sm">Checking this landlord’s payment connection…</p>}
        {availability && <p className="mt-3 text-sm font-semibold">{!availability.enabled ? availability.configured ? "The landlord’s merchant account is connected, but checkout is not enabled. Ask the landlord or TNP administrator to finish enabling payments. No money has been taken." : "This landlord has not connected a Paynow merchant account. Ask the landlord or TNP administrator to connect it before paying. No money has been taken." : availability.mode === "test" ? "TEST MODE — use the landlord's Paynow test merchant account. No real rent will be marked paid." : "Live checkout enabled for this landlord."}</p>}
        {verifiedStatus === "paid" && availability?.mode === "live" && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-950">Payment confirmed by Paynow. Your receipt is available in Payment evidence below.</p>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-lg bg-blue-100 p-3 text-sm text-blue-950">{notice}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={busy || !availability?.enabled || payment?.status !== "pending"} onClick={() => void action(true)} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Working…" : availability?.mode === "test" ? "Open test checkout" : "Continue to Paynow"}</button>
          <button type="button" disabled={busy || !payment} onClick={() => void action(false)} className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold disabled:opacity-40">Check provider status</button>
        </div>
        <p className="mt-3 text-xs text-slate-600">Returning from checkout does not prove payment. Use Check provider status to verify it and retrieve your receipt. If a checkout times out, check its status or contact support before creating another request.</p>
        <p className="mt-2 text-sm">After approval, Paynow returns you here. Check provider status to retrieve the confirmed result. If it is pending, wait before checking again. Your payment history and receipt update after provider verification; a cancelled or unsuccessful payment is not a paid receipt.</p>
        </div>
      </>}
    </section>
    <PaymentEvidence refreshKey={refresh} />
  </div>;
}
