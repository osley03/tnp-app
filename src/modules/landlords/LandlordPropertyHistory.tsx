import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Property = {property_id: string; title: string | null};
type Entry = {id: string; property_id: string; event: string; detail: string | null; occurred_at: string};
export function LandlordPropertyHistory({ landlordId, properties }: {landlordId: string; properties: Property[]}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const ids = properties.map(property => property.property_id).sort().join(",");
  useEffect(() => {
    let current = true; setLoading(true); setError(""); setEntries([]);
    async function load() {
      try {
        if (!ids) return;
        const result = await supabase.from("property_history").select("id,property_id,event,detail,occurred_at").in("property_id", ids.split(",")).order("occurred_at", {ascending: false}).limit(100);
        if (result.error) throw result.error;
        if (current) setEntries(result.data as Entry[]);
      } catch (cause) {if (current) setError(cause instanceof Error ? cause.message : "Property history could not be loaded.");}
      finally {if (current) setLoading(false);}
    }
    void load(); return () => {current = false;};
  }, [landlordId, ids, retry]);
  return <section aria-labelledby="landlord-history-title">
    <h3 id="landlord-history-title" className="text-sm font-bold">Property history under this landlord</h3>
    <p className="mt-2 text-xs text-slate-500">Recorded activity for the properties currently connected to this profile. This is listing history, not proof of legal ownership.</p>
    {loading ? <p role="status" className="mt-4 text-sm">Loading property history…</p> : error ? <div role="alert" className="mt-4 text-sm">{error}<button type="button" onClick={() => setRetry(value => value + 1)} className="ml-3 underline">Retry history</button></div> : <div className="mt-4 space-y-3">
      {entries.length === 0 && <p className="text-sm text-slate-500">No recorded history yet. Newly connected properties appear below.</p>}
      {entries.map(entry => <article key={entry.id} className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">{properties.find(property => property.property_id === entry.property_id)?.title || "Property"} · {new Date(entry.occurred_at).toLocaleDateString()}</p><h4 className="mt-1 font-semibold">{entry.event.replaceAll("_", " ")}</h4>{entry.detail && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{entry.detail}</p>}</article>)}
      {properties.map(property => <Link key={property.property_id} to="/app/property/$id" params={{id: property.property_id}} className="block rounded-xl border border-slate-200 p-3 text-sm">View listing: {property.title || "Property"} →</Link>)}
    </div>}
  </section>;
}
