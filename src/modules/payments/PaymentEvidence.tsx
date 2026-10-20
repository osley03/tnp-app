import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

export type Evidence = {
  id: string; payment_id: string; lease_id: string; payer_id: string; landlord_id: string;
  provider: string; method: string; mode: string; currency: string; amount_usd: number | string;
  merchant_reference: string; provider_reference: string; integration_id: string;
  provider_status: string; payment_status: string; verification: string; response_fingerprint: string; verified_at: string;
};
function receiptText(item: Evidence): string {
  return ["TNP PAYMENT VERIFICATION RECORD", item.mode === "test" ? "TEST ONLY — NOT PROOF OF REAL PAYMENT" : "LIVE PROVIDER RECORD",
    "", "Evidence ID: " + item.id, "Payment ID: " + item.payment_id, "Lease ID: " + item.lease_id,
    "Tenant account: " + item.payer_id, "Landlord account: " + item.landlord_id,
    "Recipient Paynow integration: " + item.integration_id, "Amount: " + Number(item.amount_usd).toFixed(2) + " " + item.currency,
    "Provider: Paynow", "Checkout preference: " + item.method, "TNP reference: " + item.merchant_reference,
    "Paynow reference: " + item.provider_reference, "Provider status: " + item.provider_status,
    "Verified at: " + item.verified_at, "Verification: " + item.verification,
    "Signed-response fingerprint: " + item.response_fingerprint, "",
    "Payment goes to the landlord's Paynow merchant account. Provider confirmation is distinct from bank/wallet settlement.",
    "This is an export of a TNP verification record. Check it against the in-app record and the provider reference. TNP does not hold these funds in escrow.",
  ].join("\n");
}
function download(item: Evidence) {
  const url = URL.createObjectURL(new Blob([receiptText(item)], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "TNP-payment-" + item.id + ".txt";
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PaymentEvidence({ refreshKey = 0 }: { refreshKey?: number }) {
  const { user } = useSession();
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [refreshKey]);
  const query = useQuery({ queryKey: ["payment-evidence", user?.id, refreshKey, page], enabled: Boolean(user?.id), queryFn: async () => {
    const result = await supabase.from("tnp_payment_evidence" as never).select("*").order("verified_at", { ascending: false }).order("id", { ascending: false }).range(page * 50, page * 50 + 49);
    if (result.error) throw new Error("Payment evidence is unavailable. The payment gateway migration may still need deployment.");
    return result.data as unknown as Evidence[];
  } });
  const requestIds=[...new Set(query.data?.map(item=>item.payment_id)||[])];
  const requests=useQuery({queryKey:["receipt-payment-references",user?.id,requestIds.join(",")],enabled:!!user?.id&&requestIds.length>0,queryFn:async()=>{const result=await supabase.from("lease_payments" as never).select("id,reference").in("id",requestIds);if(result.error)throw Error(result.error.message);return result.data as unknown as {id:string;reference:string|null}[];}});
  return <section className="tnp-payment-paper mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-slate-950">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Provider-verified payment evidence</h2>
      <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => void query.refetch()}>Refresh receipts</button></div>
    <p className="mt-2 text-sm text-slate-600">The tenant, receiving landlord and TNP administrator can access these records. Provider confirmations cannot be edited through the app. A confirmation does not guarantee that bank or wallet settlement has finished.</p>
    {query.isPending ? <p role="status" className="mt-4">Loading payment evidence…</p> : query.error ? <p role="alert" className="mt-4 text-amber-900">{query.error.message}</p> : !query.data?.length ? <p className="mt-4 text-sm text-slate-500">No provider-verified payments yet.</p> :
      <div className="mt-4 space-y-3">{query.data.map(item => <article key={item.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><strong>{Number(item.amount_usd).toFixed(2)} {item.currency} · {item.provider_status}</strong>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.mode === "test" ? "bg-amber-100 text-amber-900" : "bg-blue-50 text-blue-900"}`}>{item.mode === "test" ? "TEST — no real payment proof" : "Live provider confirmation"}</span></div>
        <dl className="mt-3 grid gap-2 break-all text-xs text-slate-600 sm:grid-cols-2">
          <div><dt className="font-semibold">Paynow reference</dt><dd>{item.provider_reference}</dd></div>
          <div><dt className="font-semibold">Verified at</dt><dd>{new Date(item.verified_at).toLocaleString()}</dd></div>
          <div><dt className="font-semibold">Rental payment reference</dt><dd>{requests.data?.find(payment=>payment.id===item.payment_id)?.reference||item.payment_id}</dd></div>
          <div><dt className="font-semibold">TNP provider reference</dt><dd>{item.merchant_reference}</dd></div>
          <div><dt className="font-semibold">Landlord account</dt><dd>{item.landlord_id}</dd></div>
        </dl>
        <button type="button" className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white" onClick={() => download(item)}>Download verification record</button>
      </article>)}</div>}
    {(page > 0 || (query.data?.length || 0) === 50) && <div className="mt-4 flex items-center gap-3 text-sm">
      <button type="button" className="rounded-lg border px-3 py-2" disabled={page === 0 || query.isPending} onClick={() => setPage(value => value - 1)}>Newer records</button>
      <span>Page {page + 1}</span>
      <button type="button" className="rounded-lg border px-3 py-2" disabled={(query.data?.length || 0) < 50 || query.isPending} onClick={() => setPage(value => value + 1)}>Older records</button>
    </div>}
  </section>;
}
