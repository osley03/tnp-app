import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  rpc,
  prepareReceipt,
  uploadReceipt,
  receiptUrl,
  hashBlob,
  fullTrail,
  downloadCsv,
  printTrail,
  type Destination,
  type Submission,
  type Decision,
} from "./api";
const field = "mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-950";
const button =
  "rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40";
const methods = {
  ecocash: "EcoCash",
  onemoney: "OneMoney",
  innbucks: "InnBucks",
  bank: "Bank transfer",
};
function errorText(e: unknown) {
  return e instanceof Error ? e.message : "The request could not be completed.";
}
export function LandlordPaymentDetails() {
  const { user } = useSession();
  const [method, setMethod] = useState("ecocash");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [institution, setInstitution] = useState("");
  const [instructions, setInstructions] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["manual-destinations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const r = await supabase
        .from("tnp_payment_destinations" as never)
        .select("*")
        .eq("landlord_id", user!.id)
        .order("revision", { ascending: false });
      if (r.error) throw Error(r.error.message);
      return r.data as unknown as Destination[];
    },
  });
  const current = Array.from(
    new Map(
      (query.data || [])
        .slice()
        .reverse()
        .map((d) => [d.method, d]),
    ).values(),
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await rpc("tnp_save_payment_destination", {
        p_method: method,
        p_account_name: name,
        p_account_number: number,
        p_institution: institution,
        p_instructions: instructions,
        p_enabled: enabled,
      });
      await query.refetch();
      setMessage("New payment-details version saved. Previous versions remain in the audit trail.");
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tnp-payment-paper my-6 rounded-2xl border bg-white p-5 text-slate-950">
      <h2 className="text-xl font-bold">Your receiving details</h2>
      <p className="mt-2 text-sm">
        Tenants pay your wallet or bank directly. Save USD receiving details only. Never enter a
        PIN, password or card security code. Only approved rentals can retrieve your current
        details.
      </p>
      {query.error && <p role="alert">{query.error.message}</p>}
      <div className="my-4 flex flex-wrap gap-2">
        {current.map((d) => (
          <button
            key={d.id}
            type="button"
            className={button}
            onClick={() => {
              setMethod(d.method);
              setName(d.account_name);
              setNumber(d.account_number);
              setInstitution(d.institution);
              setInstructions(d.instructions);
              setEnabled(d.enabled);
            }}
          >
            {methods[d.method as keyof typeof methods]} · {d.enabled ? "enabled" : "disabled"}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => void save(e)}>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <label>
            Method
            <select
              className={field}
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                const d = current.find((d) => d.method === e.target.value);
                setName(d?.account_name || "");
                setNumber(d?.account_number || "");
                setInstitution(d?.institution || "");
                setInstructions(d?.instructions || "");
                setEnabled(d?.enabled ?? true);
              }}
            >
              {Object.entries(methods).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Account holder
            <input
              required
              minLength={2}
              maxLength={120}
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Wallet phone / account number
            <input
              required
              minLength={3}
              maxLength={120}
              className={field}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </label>
          <label>
            Bank / branch (if applicable)
            <input
              maxLength={120}
              className={field}
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          </label>
          <label className="sm:col-span-2">
            Payment instructions
            <textarea
              maxLength={500}
              className={field}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Offer this receiving method
          </label>
          <button className={button}>{busy ? "Saving…" : "Save new version"}</button>
        </fieldset>
      </form>
      {message && (
        <p role="status" className="mt-3">
          {message}
        </p>
      )}
      <details className="mt-4">
        <summary>Payment-details change history</summary>
        {(query.data || []).map((d) => (
          <p key={d.id} className="mt-2 break-words text-xs">
            Version {d.revision} · {new Date(d.created_at).toLocaleString()} ·{" "}
            {methods[d.method as keyof typeof methods]} · {d.account_name} · {d.account_number} ·{" "}
            {d.enabled ? "enabled" : "disabled"}
          </p>
        ))}
      </details>
    </section>
  );
}
export function ManualTenantPayment({
  payments,
  selected,
  onSelect,
  onRefresh,
}: {
  payments: Array<{
    id: string;
    status: string;
    reference: string | null;
    amount_usd: number | string;
    label?: string;
  }>;
  selected: string;
  onSelect: (id: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const cache = useQueryClient();
  const { user } = useSession();
  const payment =
    payments.find((p) => p.id === selected) ||
    payments.find((p) => p.status === "pending") ||
    payments[0];
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const attempt = useRef({ intent: "", id: "" });
  const uploadInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setAmount(payment ? String(payment.amount_usd) : "");
    setDestination("");
    setReference("");
    setFile(null);
    setMessage("");
    if (uploadInput.current) uploadInput.current.value = "";
  }, [payment?.id]);
  const query = useQuery({
    queryKey: ["manual-pay-to", payment?.id, user?.id],
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !!payment && !!user,
    queryFn: () =>
      rpc<Destination[]>("tnp_payment_destinations_for", { p_payment_id: payment!.id }),
    retry: false,
  });
  const target = query.data?.find((d) => d.id === destination) || query.data?.[0];
  const open = useQuery({
    queryKey: ["manual-payment-open", payment?.id, user?.id],
    enabled: !!payment && !!user,
    queryFn: async () => {
      const r = await supabase
        .from("tnp_manual_payment_submissions" as never)
        .select("*")
        .eq("payment_id", payment!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (r.error) throw Error(r.error.message);
      const latest = r.data as unknown as Submission | null;
      if (!latest) return false;
      const d = await supabase
        .from("tnp_manual_payment_decisions" as never)
        .select("id")
        .eq("submission_id", latest.id)
        .maybeSingle();
      if (d.error) throw Error(d.error.message);
      return !d.data;
    },
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!payment || !target || !file || !user || busy || open.data || open.isPending || open.error)
      return;
    setBusy(true);
    setMessage("");
    let path = "";
    try {
      const intent = JSON.stringify([
        payment.id,
        target.id,
        amount,
        reference,
        date,
        file.name,
        file.size,
        file.lastModified,
      ]);
      if (attempt.current.intent !== intent) attempt.current = { intent, id: crypto.randomUUID() };
      const receipt = await uploadReceipt(
        user.id,
        payment.id,
        attempt.current.id,
        await prepareReceipt(file),
      );
      path = receipt.path;
      await rpc("tnp_submit_manual_payment", {
        p_id: attempt.current.id,
        p_payment_id: payment.id,
        p_destination_id: target.id,
        p_amount: Number(amount),
        p_paid_on: date,
        p_reference: reference,
        p_receipt_path: path,
        p_receipt_sha256: receipt.hash,
      });
      setMessage(
        "Proof submitted. Awaiting the landlord’s confirmation; this is not provider verification.",
      );
      await cache.invalidateQueries({ queryKey: ["manual-payment-trail"] });
      await cache.invalidateQueries({ queryKey: ["manual-payment-open"] });
      await onRefresh();
      attempt.current = { intent: "", id: "" };
      setFile(null);
      if (uploadInput.current) uploadInput.current.value = "";
    } catch (e) {
      setMessage(errorText(e));
      if (path) await supabase.storage.from("tnp-manual-receipts").remove([path]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tnp-payment-paper my-6 rounded-2xl border bg-white p-5 text-slate-950">
      <h2 className="text-xl font-bold">Pay rent directly to your landlord</h2>
      <p className="mt-2 text-sm">
        1. Review the details. 2. Pay in your wallet or banking app using the TNP reference. 3.
        Submit your proof here. TNP never receives or holds the money.
      </p>
      {!payment ? (
        <p className="mt-4">
          Payment requests appear after your landlord approves your application.
        </p>
      ) : (
        <>
          <label className="mt-4 block">
            Approved charge
            <select
              className={field}
              value={payment.id}
              disabled={busy}
              onChange={(e) => onSelect(e.target.value)}
            >
              {payments.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label || p.reference || p.id} · USD {Number(p.amount_usd).toFixed(2)} ·{" "}
                  {p.status}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={button + " mt-3"}
            disabled={busy}
            onClick={() => {
              void query.refetch();
              void open.refetch();
            }}
          >
            Refresh details & review state
          </button>
          {open.data && (
            <p role="status" className="mt-3 rounded-lg bg-amber-100 p-3">
              Proof is awaiting landlord review. Do not send another payment.
            </p>
          )}
          {open.error && <p role="alert">{open.error.message}</p>}
          {payment.status === "paid" && (
            <p className="mt-3 font-semibold">
              This charge is already recorded as paid. Do not pay it again.
            </p>
          )}
          <p className="mt-4 text-lg font-bold">
            Amount requested: USD {Number(payment.amount_usd).toFixed(2)}
          </p>
          <p className="mt-2 break-all">
            Use reference: <strong>{payment.reference || payment.id}</strong>
          </p>
          <p className="mt-2 text-xs">
            Check the recipient name and USD wallet/account before approving any external transfer.
            Do not pay twice while proof is awaiting review.
          </p>
          {query.isPending ? (
            <p role="status">Loading approved landlord details…</p>
          ) : query.error ? (
            <p role="alert" className="mt-3">
              {query.error.message}
            </p>
          ) : !target ? (
            <p className="mt-3">
              The landlord has not saved an enabled receiving method yet. Ask them to add their
              details before paying.
            </p>
          ) : (
            <>
              <label className="mt-4 block">
                Pay to
                <select
                  className={field}
                  value={target.id}
                  disabled={busy}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  {query.data?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {methods[d.method as keyof typeof methods]}
                    </option>
                  ))}
                </select>
              </label>
              <dl className="my-4 space-y-2 rounded-xl bg-slate-50 p-4">
                <div>
                  <dt className="font-semibold">Account holder</dt>
                  <dd>{target.account_name}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Phone / account</dt>
                  <dd className="break-all">{target.account_number}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Bank / branch</dt>
                  <dd>{target.institution || "Not applicable"}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Instructions</dt>
                  <dd className="whitespace-pre-wrap">
                    {target.instructions || "Use your TNP payment reference."}
                  </dd>
                </div>
              </dl>
              <form onSubmit={(e) => void submit(e)}>
                <fieldset
                  disabled={
                    busy ||
                    open.isPending ||
                    !!open.error ||
                    !!open.data ||
                    !["pending", "disputed"].includes(payment.status)
                  }
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <label>
                    Amount actually paid (USD)
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="1000000"
                      className={field}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <label>
                    Date paid
                    <input
                      required
                      type="date"
                      className={field}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                  <label>
                    Wallet / bank transaction reference
                    <input
                      required
                      minLength={3}
                      maxLength={120}
                      className={field}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </label>
                  <label>
                    Receipt screenshot
                    <input
                      ref={uploadInput}
                      required
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className={field}
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <p className="text-xs">
                    Upload proof without your PIN, password, full card number or unrelated
                    transactions. The screenshot is stored privately.
                  </p>
                  <button className={button}>
                    {busy ? "Submitting…" : "Submit payment proof"}
                  </button>
                </fieldset>
              </form>
            </>
          )}
          {message && (
            <p role="status" className="mt-3 rounded-lg bg-slate-100 p-3">
              {message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
function SubmissionCard({
  submission,
  decision,
  role,
  onRefresh,
}: {
  submission: Submission;
  decision?: Decision | undefined;
  role: string;
  onRefresh: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [image, setImage] = useState("");
  async function view() {
    setBusy(true);
    try {
      const url = await receiptUrl(submission.receipt_path);
      const response = await fetch(url);
      if (!response.ok) throw Error("Receipt could not be loaded.");
      const blob = await response.blob();
      if ((await hashBlob(blob)) !== submission.receipt_sha256)
        throw Error("Receipt checksum mismatch. Preserve the evidence and contact admin.");
      const local = URL.createObjectURL(blob);
      setImage((old) => {
        if (old) URL.revokeObjectURL(old);
        return local;
      });
      setMessage("Stored receipt checksum matches. The image remains tenant-supplied evidence.");
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image);
    },
    [image],
  );
  async function decide(value: string) {
    setBusy(true);
    setMessage("");
    try {
      await rpc("tnp_decide_manual_payment", {
        p_submission_id: submission.id,
        p_decision: value,
        p_note: note,
      });
      await onRefresh();
      setMessage("Decision saved and locked.");
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="mt-4 rounded-xl border border-slate-300 p-4">
      <h3 className="font-semibold">
        USD {Number(submission.amount_usd).toFixed(2)} ·{" "}
        {decision?.decision || "Awaiting landlord confirmation"}
      </h3>
      <p className="mt-2 break-all text-sm">
        TNP reference: {submission.tnp_reference} · Transaction: {submission.transaction_reference}
      </p>
      <p className="mt-2 text-xs">
        Reported paid: {submission.paid_on} · Submitted:{" "}
        {new Date(submission.created_at).toLocaleString()}
      </p>
      <p className="mt-2 break-all text-xs">
        Lease: {submission.lease_id} · Tenant: {submission.tenant_id}
      </p>
      <p className="mt-2 text-sm">
        Paid to {submission.destination_snapshot.account_name} ·{" "}
        {submission.destination_snapshot.method} · {submission.destination_snapshot.account_number}
      </p>
      {submission.flags.length > 0 && (
        <p role="status" className="mt-3 rounded bg-amber-100 p-3 text-sm">
          Flagged: {submission.flags.join(", ").replaceAll("_", " ")}. Expected USD{" "}
          {Number(submission.expected_amount_usd).toFixed(2)}.
        </p>
      )}
      <button
        type="button"
        className={button + " mt-3"}
        disabled={busy}
        onClick={() => void view()}
      >
        View private receipt
      </button>
      {image && (
        <img
          src={image}
          alt="Tenant-submitted payment receipt"
          className="mt-3 max-h-[600px] max-w-full object-contain"
        />
      )}
      {decision && (
        <p className="mt-3 text-sm">
          Landlord {decision.decision} on {new Date(decision.created_at).toLocaleString()}.{" "}
          {decision.note}{" "}
          {decision.decision === "disputed" && (
            <a className="underline" href={"/app/" + role + "/disputes"}>
              Open disputes
            </a>
          )}
        </p>
      )}
      {role === "landlord" && !decision && (
        <div className="mt-4">
          <label>
            Confirmation / dispute note
            <textarea
              maxLength={2000}
              className={field}
              value={note}
              disabled={busy}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <p className="my-3 text-xs">
            Confirm only after checking your own wallet or bank. Amount mismatches cannot settle the
            invoice; dispute them and agree a correction. A decision cannot be edited.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className={button}
              disabled={busy || submission.flags.includes("amount_mismatch")}
              onClick={() => void decide("confirmed")}
            >
              Confirm received
            </button>
            <button
              className={button}
              disabled={busy || note.trim().length < 10}
              onClick={() => void decide("disputed")}
            >
              Dispute payment
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </article>
  );
}
export function ManualPaymentTrail({
  role,
  onRefresh,
}: {
  role: "tenant" | "landlord" | "admin";
  onRefresh?: () => Promise<void>;
}) {
  const { user } = useSession();
  const [lease, setLease] = useState("");
  const [draft, setDraft] = useState("");
  const [dispute, setDispute] = useState("");
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["manual-payment-trail", user?.id, lease, page],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("tnp_manual_payment_submissions" as never)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      if (lease) q = q.eq("lease_id", lease);
      const r = await q.range(page * 25, page * 25 + 24);
      if (r.error) throw Error(r.error.message);
      const submissions = r.data as unknown as Submission[];
      const ids = submissions.map((s) => s.id);
      const decisions = ids.length
        ? await supabase
            .from("tnp_manual_payment_decisions" as never)
            .select("*")
            .in("submission_id", ids)
        : { data: [], error: null };
      if (decisions.error) throw Error(decisions.error.message);
      return {
        submissions,
        decisions: decisions.data as unknown as Decision[],
        count: r.count || 0,
      };
    },
  });
  async function refresh() {
    await query.refetch();
    await onRefresh?.();
  }
  async function resolveDispute() {
    setMessage("");
    try {
      const r = await supabase
        .from("disputes" as never)
        .select("lease_id")
        .eq("id", dispute.trim())
        .single();
      if (r.error) throw Error(r.error.message);
      const id = (r.data as unknown as { lease_id: string | null }).lease_id;
      if (!id) throw Error("This dispute has no linked lease. Select the relevant lease directly.");
      setLease(id);
      setDraft(id);
      setPage(0);
    } catch (e) {
      setMessage(errorText(e));
    }
  }
  async function exportTrail(pdf: boolean) {
    if (!lease) {
      setMessage("Filter by a lease before exporting or checking its chain.");
      return;
    }
    const popup = pdf ? window.open("", "_blank") : null;
    if (pdf && !popup) {
      setMessage("Allow the evidence window to open for Print / save as PDF.");
      return;
    }
    setBusy(true);
    try {
      if (popup) popup.opener = null;
      const verification = await rpc<{ valid: boolean; entries: number; head?: string }>(
        "tnp_verify_manual_chain",
        { p_lease_id: lease },
      );
      const events = await fullTrail(lease);
      if (pdf) {
        const images: Array<{ label: string; url: string }> = [];
        for (const event of events) {
          if (event.payload["event"] !== "tenant_submitted") continue;
          const proof = event.payload["submission"] as Submission;
          try {
            const response = await fetch(await receiptUrl(proof.receipt_path));
            if (!response.ok) throw Error("Missing receipt");
            const blob = await response.blob();
            if ((await hashBlob(blob)) !== proof.receipt_sha256) throw Error("Checksum mismatch");
            images.push({
              label: "Tenant receipt: " + proof.transaction_reference,
              url: URL.createObjectURL(blob),
            });
          } catch {
            images.push({
              label: "Receipt needs investigation: " + proof.transaction_reference,
              url: "",
            });
          }
        }
        printTrail(popup!, events, lease, verification, images);
        const cleanup = () =>
          images.forEach((image) => {
            if (image.url) URL.revokeObjectURL(image.url);
          });
        popup!.addEventListener("beforeunload", cleanup, { once: true });
        setTimeout(cleanup, 600000);
      } else downloadCsv(events, lease);
      setMessage(
        "Stored chain " +
          (verification.valid ? "matches" : "FAILED validation") +
          " · " +
          verification.entries +
          " entries. Keep the exported copy and head hash separately.",
      );
    } catch (e) {
      popup?.close();
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tnp-payment-paper my-6 rounded-2xl border bg-white p-5 text-slate-950">
      <h2 className="text-xl font-bold">Manual payment evidence & confirmations</h2>
      <p className="mt-2 text-sm">
        These records show tenant claims and landlord decisions. They are not bank/provider
        verification. Confirmed records are locked; disputes and corrections retain the original
        trail.
      </p>
      <div className="my-4 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1">
          Lease ID filter
          <input
            className={field}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste a lease ID from a record below"
          />
        </label>
        <button
          className={button}
          onClick={() => {
            setLease(draft.trim());
            setPage(0);
          }}
        >
          Apply filter
        </button>
        <button className={button} onClick={() => void refresh()}>
          Refresh evidence
        </button>
      </div>
      {role === "admin" && (
        <div className="my-3 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1">
            Dispute ID
            <input className={field} value={dispute} onChange={(e) => setDispute(e.target.value)} />
          </label>
          <button className={button} onClick={() => void resolveDispute()}>
            Open dispute’s lease trail
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          disabled={busy || !lease}
          className={button}
          onClick={() => void exportTrail(false)}
        >
          Export CSV & check chain
        </button>
        <button disabled={busy || !lease} className={button} onClick={() => void exportTrail(true)}>
          Print / save PDF
        </button>
      </div>
      {message && (
        <p role="status" className="mt-3">
          {message}
        </p>
      )}
      {query.error && (
        <p role="alert" className="mt-3">
          {query.error.message}
        </p>
      )}
      {query.isPending ? (
        <p role="status">Loading evidence…</p>
      ) : !query.data?.submissions.length ? (
        <p className="mt-4">No manual submissions in this view.</p>
      ) : (
        query.data.submissions.map((s) => (
          <SubmissionCard
            key={s.id}
            submission={s}
            decision={query.data?.decisions.find((d) => d.submission_id === s.id)}
            role={role}
            onRefresh={refresh}
          />
        ))
      )}
      <div className="mt-4 flex items-center gap-3">
        <button className={button} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          className={button}
          disabled={(page + 1) * 25 >= (query.data?.count || 0)}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
