import { useState } from 'react';
import { applicationStatus } from '@/lib/application-status';
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppBar, Page, Card, Stat, TrustMeter, Empty } from "@/components/tnp/AppShell";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/app/applicant/$id")({
  head: () => ({
    meta: [
      { title: "Applicant trust profile — Landlord vetting | TNP" },
      {
        name: "description",
        content:
          "Review an applicant's verified identity, trust score, rental references and lease request before approving or declining.",
      },
      { property: "og:title", content: "Applicant trust profile — TNP" },
      {
        property: "og:description",
        content: "Verified applicant history before you approve a lease.",
      },
    ],
  }),
  component: Applicant,
});

function Applicant() {
  const { id } = useParams({ from: "/_authenticated/app/applicant/$id" });
  const { role, fullName, user } = useSession();
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const qc = useQueryClient();

  const { data, error: loadError, isLoading } = useQuery({
    queryKey: ["applicant", user?.id, id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rq, error } = await supabase
        .from("lease_requests")
        .select("*, properties(title, suburb, rent_usd, deposit_usd)")
        .eq("id", id)
        .single();
      if (error) throw error;
      const [profile, refs] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", rq.tenant_id).maybeSingle(),
        supabase
          .from("reviews")
          .select("*")
          .eq("subject_id", rq.tenant_id)
          .order("created_at", { ascending: false }),
      ]);
      return { rq, profile: profile.data, refs: refs.data ?? [] };
    },
  });

  async function decide(status: string) {
    if (saving) return;
    if (status === "Rejected" && !rejectionReason.trim()) { setActionError("Please provide a reason for declining this application."); return; }
    setSaving(true); setActionError('');
    try {
      const result = await supabase.from('lease_requests').update({ status, rejection_reason: status === "Rejected" ? rejectionReason.trim() : null }).eq('id', id).select('id').single();
      if (result.error) throw result.error;
      await qc.invalidateQueries({ queryKey: ['applicant'] });
      await qc.invalidateQueries({ queryKey: ['landlord-lease-requests'] });
      await qc.invalidateQueries({ queryKey: ['landlord-applicants-requests'] });
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Unable to save this decision.'); }
    finally { setSaving(false); }
  }

  if (!data) {
    return (
      <Page>
        <AppBar role={role ?? "landlord"} who={fullName} />
        <Empty text={loadError ? "Unable to load this applicant. Please retry from your dashboard." : isLoading ? "Loading applicant…" : "Applicant not found."} />
      </Page>
    );
  }

  const { rq, profile, refs } = data;
  const prop = rq.properties as {
    title: string;
    suburb: string;
    rent_usd: number;
    deposit_usd: number;
  } | null;

  return (
    <Page>
      <AppBar
        role={role ?? "landlord"}
        who={fullName}
        back={{ to: "/app/landlord", label: "Back to requests" }}
      />

      <div className="space-y-3">
        <Card
          title={profile?.full_name ?? "Applicant"}
          meta={profile?.verification ?? "unverified"}
        >
          <TrustMeter score={profile?.trust_score ?? 50} label="tenant trust" />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat k="REFERENCES" v={String(refs.length)} />
            <Stat k="STATUS" v={rq.status} tone="text-ochre" />
            <Stat k="MOVE-IN" v={rq.move_in ? new Date(rq.move_in).toLocaleDateString() : "—"} />
          </div>
          {profile?.bio && <p className="mt-2 text-[11px] text-mut">{profile.bio}</p>}
          {profile?.phone && <p className="mt-1 font-mono text-[9px] text-mut">{profile.phone}</p>}
        </Card>

        <Card title="Lease request" meta={prop?.suburb ?? ""}>
          <div className="grid grid-cols-2 gap-2">
            <Stat k="PROPERTY" v={prop?.title ?? "—"} />
            <Stat k="RENT" v={prop ? `$${prop.rent_usd}/mo` : "—"} />
          </div>
          {rq.message && <p className="mt-2 text-[11px] text-mut">“{rq.message}”</p>}
          {actionError && <p role="alert" className="mt-3 text-clay">{actionError}</p>}
          <label className="mt-3 block text-[12px]">Reason for declining (required when declining)
            <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg bg-panel-2 p-2 ring-1 ring-line" />
          </label>
          {rq.rejection_reason && <p className="mt-2 text-[12px]">Decision reason: {rq.rejection_reason}</p>}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={saving || applicationStatus(rq.status) !== 'Pending review'}
              onClick={() => decide("Approved")}
              className="rounded-xl bg-terra px-3 py-2 font-display text-[12px] font-semibold text-ink"
            >
              Approve application
            </button>
            <button
              type="button"
              disabled={saving || applicationStatus(rq.status) !== 'Pending review'}
              onClick={() => decide("Rejected")}
              className="rounded-xl bg-panel-2 px-3 py-2 font-display text-[12px] font-semibold text-clay ring-1 ring-line"
            >
              Decline
            </button>
          </div>
          <p className="mt-2 font-mono text-[9px] text-mut">
            Application approval does not sign a lease or collect a deposit. Check the lease and payment records separately.
          </p>
        </Card>

        <Card title="Verified references" meta="lease-confirmed">
          {refs.length === 0 ? (
            <Empty text="No references recorded for this applicant yet." />
          ) : (
            <ul className="space-y-2">
              {refs.map((r) => (
                <li key={r.id} className="rounded-lg bg-panel-2 px-2.5 py-2 ring-1 ring-line">
                  <span className="font-mono text-[9px] text-terra">
                    {"★".repeat(r.rating)}
                    {"☆".repeat(Math.max(0, 5 - r.rating))}
                  </span>
                  <p className="mt-1 text-[11px]">{r.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}
