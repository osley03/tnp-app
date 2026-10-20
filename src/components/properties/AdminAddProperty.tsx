import { validateProperty } from '@/lib/property-validation';
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PropertyFormModal, EMPTY_FORM, type PropertyForm } from "./PropertyFormModal";
import { supabase } from "@/integrations/supabase/client";
import { tourIdFromUrl } from "@/lib/tour-links";
export function AdminAddProperty({
  profiles,
}: {
  profiles: { id: string; full_name: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PropertyForm>(EMPTY_FORM);
  const [ownerId, setOwnerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const client = useQueryClient();
  const owners=useQuery({queryKey:['admin-property-owners'],enabled:open,queryFn:async()=>{
    const {data,error}=await supabase.from('user_roles').select('user_id').eq('role','landlord');
    if(error)throw new Error(error.message);return new Set((data??[]).map(row=>row.user_id));
  }});
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    const validation=validateProperty(form);
    if(validation){setError(validation);return;}
    if (!ownerId || !owners.data?.has(ownerId)) {
      setError("Choose a landlord account as the property owner.");
      return;
    }
    if (!form.title.trim() || !form.city.trim() || !form.suburb.trim()) {
      setError("Enter the title, city and suburb.");
      return;
    }
    const rent = ["For Rent", "For Lease", "For Rent or Sale"].includes(form.listing_type);
    const sale = ["For Sale", "For Rent or Sale"].includes(form.listing_type);
    if ((rent && !form.rent_usd) || (sale && !form.price_usd)) {
      setError("Enter the listing price.");
      return;
    }
    for (const value of [
      form.rent_usd,
      form.price_usd,
      form.deposit_usd,
      form.beds,
      form.baths,
      form.rooms,
      form.size,
    ]) {
      if (value && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        setError("Prices, room counts and sizes must be valid non-negative numbers.");
        return;
      }
    }
    if (form.tour_url.trim() && !tourIdFromUrl(form.tour_url.trim(), window.location.origin)) {
      setError("Paste a TNP tour URL created in the tour manager.");
      return;
    }
    setSaving(true);
    try {
      const result = await supabase
        .from("properties")
        .insert({
          owner_id: ownerId,
          title: form.title.trim(),
          city: form.city.trim(),
          suburb: form.suburb.trim(),
          property_category: form.property_category,
          property_type: form.property_type,
          listing_type: form.listing_type,
          rent_usd: rent ? Number(form.rent_usd) : 0,
          deposit_usd: Number(form.deposit_usd || 0),
          price_usd: sale ? Number(form.price_usd) : null,
          price_unit: form.price_unit,
          beds: Number(form.beds || 0),
          baths: Number(form.baths || 0),
          rooms: form.rooms ? Number(form.rooms) : null,
          size: form.size ? Number(form.size) : null,
          size_unit: form.size_unit,
          land_use: form.land_use.trim() || null,
          water_available: form.water_available,
          electricity_available: form.electricity_available,
          road_access: form.road_access,
          zoning: form.zoning.trim() || null,
          title_status: form.title_status.trim() || null,
          description: form.description.trim() || null,
          amenities: form.amenities
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          image_url: form.image_url.trim() || null,
          tour_url: form.tour_url.trim() || null,
          available: form.available,
          verified: form.verified,
        })
        .select("id")
        .single();
      if (result.error) throw new Error(result.error.message);
      setOpen(false);
      setForm(EMPTY_FORM);
      setOwnerId("");
      await client.invalidateQueries({ queryKey: ["admin-properties-centre"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add the property.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950"
      >
        Add property
      </button>
      {open && (
        <PropertyFormModal
          form={form}
          setForm={setForm}
          editing={false}
          saving={saving}
          errorMessage={error}
          onSubmit={save}
          onClose={() => {
            if (!saving) setOpen(false);
          }}
          ownerControl={
            <label className="block text-sm font-bold text-slate-900">
              Property owner
              <select
                required
                value={ownerId}
                disabled={saving || owners.isLoading}
                onChange={(event) => setOwnerId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950"
              >
                <option value="">{owners.isLoading ? "Loading landlords…" : "Choose a landlord"}</option>
                {profiles.filter(profile=>owners.data?.has(profile.id)).map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name || profile.id}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs font-normal text-slate-600">
                {owners.error ? "Unable to load landlord accounts. Close the form and retry." : "Tours must belong to the selected landlord and be published."}
              </span>
            </label>
          }
        />
      )}
    </>
  );
}
