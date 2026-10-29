import {PropertyTourLink} from '@/modules/virtual-tours/components/PropertyTourLink';
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppBar, Page, Card, Stat, TrustMeter, Empty } from "@/components/tnp/AppShell";
import { useSession } from "@/lib/session";
import { tourIdFromUrl, tourLink } from "@/lib/tour-links";
import tourPanorama from "@/assets/tour-panorama.jpg";

export const Route = createFileRoute("/_authenticated/app/property/$id")({
  head: () => ({
    meta: [
      { title: "Property details & landlord trust profile | TNP" },
      {
        name: "description",
        content:
          "Verified property information, recorded property history, landlord trust score and lease-confirmed tenant reviews before you request a lease.",
      },
      { property: "og:title", content: "Property details — TNP" },
      { property: "og:description", content: "Verified property and landlord information." },
    ],
  }),
  component: PropertyDetail,
});

function PropertyDetail() {
  const { id } = useParams({ from: "/_authenticated/app/property/$id" });
  const { user, role, fullName, trust } = useSession();
  const qc = useQueryClient();
  const [moveIn, setMoveIn] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [sending,setSending]=useState(false);

  const { data, error: loadError, isLoading } = useQuery({
    queryKey: ["property", user?.id, id],
    enabled: !!user,
    queryFn: async () => {
      const { data: p, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      const [owner, ownerReviews, history] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", p.owner_id).maybeSingle(),
        supabase
          .from("reviews")
          .select("*")
          .eq("subject_id", p.owner_id)
          .eq("moderation_status", "approved")
          .order("created_at", { ascending: false }),
        supabase
          .from("property_history")
          .select("*")
          .eq("property_id", id)
          .order("occurred_at", { ascending: false }),
      ]);
      return {
        p,
        owner: owner.data,
        reviews: ownerReviews.data ?? [],
        history: history.data ?? [],
      };
    },
  });

  const { data: existing, isLoading: checkingRequest, error: requestError } = useQuery({
    queryKey: ["req", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease_requests")
        .select("id, status")
        .eq("property_id", id)
        .eq("tenant_id", user!.id)
        .in('status',['Pending review','pending','pending review','pending_review','submitted','under review','under_review','Approved','approved','accepted'])
        .order('created_at',{ascending:false}).limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function requestLease() {
    if(!user||sending||role!=='tenant'||!data?.p.available)return;
    if(checkingRequest || requestError || existing)return;
    if(!moveIn || moveIn < new Date().toISOString().slice(0,10)){setSent('Please choose a move-in date today or later.');return;}
    if(message.trim().length>2000){setSent('Please keep your message within 2,000 characters.');return;}
    setSending(true);setSent(null);
    try {
      const {error}=await supabase.from('lease_requests').insert({property_id:id,tenant_id:user.id,move_in:moveIn,message:message.trim()||null});
      if(error)throw new Error(error.message);
      setSent('Request sent. The landlord can now review your application.');
      await qc.invalidateQueries({queryKey:['req',id,user.id]});
      await qc.invalidateQueries({queryKey:['tenant-applications']});
    }catch(error){setSent(error instanceof Error?error.message:'Unable to send your request. Please retry.');}
    finally{setSending(false);}
  }

  if (!data) {
    return (
      <Page>
        <AppBar role={role ?? "tenant"} who={fullName} />
        <Empty text={loadError ? "Unable to load this property. Return to search and retry." : isLoading ? "Loading property…" : "Property not found."} />
      </Page>
    );
  }

  const { p, owner, reviews, history } = data;
  const rentalListing = ["for rent","for lease","for rent or sale","rent","rental"].includes(String((p as unknown as Record<string,unknown>)["listing_type"] ?? "For Rent").trim().toLowerCase());
  const avg = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;

  return (
    <Page>
      <AppBar
        role={role ?? "tenant"}
        who={`${fullName} · Trust ${trust}`}
        back={{ to: role === "landlord" ? "/app/landlord/properties" : role === "admin" ? "/app/admin/properties" : "/app/tenant/properties", label: "Back to properties" }}
      />

      <div className="space-y-3">
        <section className="overflow-hidden rounded-2xl ring-1 ring-line">
          <img
            src={p.image_url || tourPanorama}
            alt={`${p.title} in ${p.suburb}`}
            className="aspect-[16/9] w-full object-cover"
          />
          <div className="bg-panel p-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[14px] font-semibold">{p.title}</h2>
              <span className="font-mono text-[11px] text-ochre">${p.rent_usd}/mo</span>
            </div>
            <p className="mt-0.5 text-[11px] text-mut">
              {p.suburb}, {p.city} · {p.beds} bed · {p.baths} bath · {p.property_type}
            </p>
            {p.description && <p className="mt-2 text-[11px] text-mut">{p.description}</p>}
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Stat k="DEPOSIT" v={`$${p.deposit_usd}`} />
              <Stat k="STATUS" v={p.available ? "Available" : "Leased"} />
              <Stat
                k="VERIFIED"
                v={p.verified ? "Yes" : "Pending"}
                tone={p.verified ? "text-terra" : "text-clay"}
              />
            </div>
            {p.amenities.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.amenities.map((a) => (
                  <span
                    key={a}
                    className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[9px] text-mut ring-1 ring-line"
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}
            {p.fraud_flags.length > 0 && (
              <p className="mt-2 rounded-lg bg-clay/10 px-2 py-1.5 font-mono text-[9px] text-clay ring-1 ring-clay/30">
                ⚠ {p.fraud_flags.join(" · ")}
              </p>
            )}
          </div>
        </section>

        {p.tour_url && <PropertyTourLink value={p.tour_url} imageUrl={p.image_url} propertyTitle={p.title} propertyId={p.id}/>}
        <Card title="Landlord profile" meta={owner?.verification ?? "unverified"}>
          <TrustMeter score={owner?.trust_score ?? 50} label={owner?.full_name ?? "Landlord"} />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat k="REVIEWS" v={String(reviews.length)} />
            <Stat k="AVG RATING" v={avg ? `${avg}★` : "—"} />
            <Stat
              k="ON TNP SINCE"
              v={owner ? new Date(owner.created_at).getFullYear().toString() : "—"}
            />
          </div>
          {owner?.bio && <p className="mt-2 text-[11px] text-mut">{owner.bio}</p>}
        </Card>

        <Card title="Verified reviews of this landlord" meta="lease-confirmed">
          {reviews.length === 0 ? (
            <Empty text="No reviews yet for this landlord." />
          ) : (
            <ul className="space-y-2">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-lg bg-panel-2 px-2.5 py-2 ring-1 ring-line">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-terra">
                      {"★".repeat(r.rating)}
                      {"☆".repeat(Math.max(0, 5 - r.rating))}
                    </span>
                    <span className="font-mono text-[9px] text-mut">
                      {r.lease_confirmed ? "LEASE CONFIRMED" : "UNVERIFIED"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px]">{r.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Property history" meta="recorded events">
          {history.length === 0 ? (
            <Empty text="No recorded history entries yet." />
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="rounded-lg bg-panel-2 px-2.5 py-2 ring-1 ring-line">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]">{h.event}</span>
                    <span className="font-mono text-[9px] text-mut">
                      {new Date(h.occurred_at).toLocaleDateString()}
                    </span>
                  </div>
                  {h.detail && <p className="mt-0.5 text-[11px] text-mut">{h.detail}</p>}
                  <p className="mt-1 font-mono text-[9px] text-mut">hash {h.entry_hash}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {role === "tenant" && rentalListing && (
          <Card title="Request this lease" meta={existing ? existing.status : "application"}>
            {requestError && <p role="alert">Unable to check your existing application. Refresh before applying.</p>}
            {existing ? (
              <Empty text={`You already requested this property. Status: ${existing.status}.`} />
            ) : (
              <div className="space-y-2">
                <label className="block">
                  <span className="font-mono text-[9px] text-mut">MOVE-IN DATE</span>
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0,10)}
                    required
                    value={moveIn}
                    onChange={(e) => setMoveIn(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-panel-2 px-2.5 py-2 text-[12px] ring-1 ring-line outline-none focus:ring-terra/50"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-[9px] text-mut">MESSAGE TO LANDLORD</span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    className="mt-1 w-full rounded-lg bg-panel-2 px-2.5 py-2 text-[12px] ring-1 ring-line outline-none focus:ring-terra/50"
                  />
                </label>
                <button
                  type="button"
                  onClick={requestLease}
                  disabled={sending || checkingRequest || !!requestError || !p.available}
                  className="w-full rounded-xl bg-terra px-3 py-2.5 font-display text-[12px] font-semibold text-ink"
                >
                  {sending ? "Sending…" : p.available ? "Send lease request" : "Property unavailable"}
                </button>
                {sent && <p className="text-[11px] text-mut">{sent}</p>}
              </div>
            )}
          </Card>
        )}
      </div>
    </Page>
  );
}
