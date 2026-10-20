import {externalTour} from '@/lib/external-tours';
import {CaptureGuide} from './CaptureGuide';
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addScenes, loadEditor, normalizeTour, saveTour, validatePanorama } from "../api/tours";
import { newHotspot } from "../lib/model";
import { unreachableRooms } from "../lib/walkthrough";
import { TourCanvas } from "../viewer/TourCanvas";
import { tourLink, tourIdFromUrl } from "@/lib/tour-links";
import type { TourDocument, ViewPosition } from "../types";

export function PropertyTourBuilder({ value, title, onChange, onState }: {
  value: string; title: string; onChange: (url: string) => void;
  onState: (state: { busy: boolean; dirty: boolean }) => void;
}) {
  const [tours, setTours] = useState<Array<{ id: string; title: string }>>([]);
  const [doc, setDoc] = useState<TourDocument | null>(null);
  const [roomId, setRoomId] = useState("");
  const [destination, setDestination] = useState("");
  const [placing, setPlacing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { onState({ busy, dirty }); }, [busy, dirty, onState]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;
      const result = await supabase.from("tnp_tours").select("id,title")
        .eq("owner_id", user.data.user.id).eq("is_published", true)
        .in("visibility", ["public", "unlisted"]).order("created_at", { ascending: false });
      if (active && !result.error) setTours(result.data || []);
      if (active && result.error) setError("Could not load your tours. You can retry by reopening this form.");
    })();
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  const room = doc?.scenes.find(item => item.id === roomId) || doc?.scenes[0];
  function change(fn: (next: TourDocument) => void) {
    setDoc(current => { if (!current) return current; const next = structuredClone(current); fn(next); return next; });
    setDirty(true);
  }
  async function upload(files: File[]) {
    if (!files.length) return;
    setBusy(true); setError(""); setMessage("Checking room images…");
    let draft = doc;
    try {
      for (const file of files) await validatePanorama(file);
      if (!draft) {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw new Error("Sign in as a landlord before uploading rooms.");
        const id = crypto.randomUUID();
        const result = await supabase.from("tnp_tours").insert({ id, owner_id: data.user.id,
          title: title.trim().slice(0, 120) || "Property walkthrough", visibility: "unlisted", is_published: false });
        if (result.error) throw new Error(result.error.message);
        draft = normalizeTour({ id, owner_id: data.user.id, title: title.trim().slice(0, 120) || "Property walkthrough",
          description: "", visibility: "unlisted", is_published: false, revision: 0, settings: {}, scenes: [] });
        setDoc(draft);
      } else if (dirty) {
        await saveTour(draft, null);
        draft = await loadEditor(draft.id);
        setDoc(draft); setDirty(false);
      }
      setMessage("Uploading rooms… Keep this form open.");
      await addScenes(draft, files);
      const fresh = await loadEditor(draft.id);
      setDoc(fresh); setRoomId(fresh.scenes[0]?.id || ""); setDirty(false);
      setMessage("Rooms uploaded. Name each room, then connect its doorways below.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed. Please retry."); setMessage(""); }
    finally { setBusy(false); }
  }
  async function persist(publish: boolean) {
    if (!doc) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (publish || doc.is_published) {
        const missing = unreachableRooms(doc);
        if (missing.length) throw new Error("Connect these rooms from the entrance before attaching: " + missing.join(", ") + ". Add return hotspots so tenants can walk back too.");
      }
      const next = { ...doc, is_published: publish || doc.is_published };
      await saveTour(next, null);
      const fresh = await loadEditor(doc.id);
      setDoc(fresh); setDirty(false); setRefresh(count => count + 1);
      if (publish) onChange(tourLink(fresh.id, window.location.origin));
      setMessage(publish ? "Tour published and selected. Save the property below to attach it to the listing." : "Tour saved. You can also find it in My tours.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save tour."); }
    finally { setBusy(false); }
  }
  function place(position: ViewPosition) {
    if (!room || !destination || destination === room.id) return;
    const name = doc?.scenes.find(item => item.id === destination)?.name || "room";
    change(next => next.scenes.find(item => item.id === room.id)!.settings.hotspots.push({
      ...newHotspot(position), targetSceneId: destination, label: "Go to " + name, icon: "door", pulse: true,
    }));
    setPlacing(false);
    setMessage("Doorway added. Open the destination room and place a return hotspot at its real doorway.");
  }
  return <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-950">
    <h3 className="font-bold">360° room walkthrough <span className="font-normal text-slate-500">(optional)</span></h3>
    <p className="mt-2 text-sm text-slate-600">Upload one full 360° photo per room. Place doorway arrows so tenants can move through the property.</p>
    <CaptureGuide/><label className="mt-4 block text-sm font-semibold">Use an existing published tour
      <select className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3" value={value}
        disabled={busy} onChange={event => onChange(event.target.value)}>
        <option value="">No tour selected</option>
        {value && !tours.some(tour => tourLink(tour.id, window.location.origin) === value) && <option value={value}>Current attached tour</option>}
        {tours.map(tour => <option key={tour.id} value={tourLink(tour.id, window.location.origin)}>{tour.title}</option>)}
      </select>
    </label>
    {!doc && value && <button type="button" disabled={busy} className="mt-3 underline" onClick={async () => {
      const id = tourIdFromUrl(value, window.location.origin); if (!id) { setError("This is an external tour. Open it with its provider to edit it."); return; }
      setBusy(true); setError(""); try { const loaded = await loadEditor(id); setDoc(loaded); setRoomId(loaded.scenes[0]?.id || ""); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open tour."); } finally { setBusy(false); }
    }}>Edit selected tour</button>}
    <label className="mt-5 block rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 text-sm font-semibold">
      {doc ? "Add more room panoramas" : "1. Upload your room panoramas"}
      <input className="mt-3 block w-full" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy}
        onChange={event => { const files = Array.from(event.currentTarget.files || []); event.currentTarget.value = ""; void upload(files); }} />
      <span className="mt-2 block text-xs font-normal text-slate-600">Full spherical 2:1 JPEG, PNG or WebP, up to 20 MB each. A normal photo or a phone's wide panorama cannot show a complete room. Capture/export a full 360° image with a 360° camera or capture app.</span>
    </label>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
    {doc && room && <div className="mt-5 space-y-4">
      <h4 className="font-bold">2. Name rooms and connect doorways</h4>
      <div className="flex flex-wrap gap-2">{doc.scenes.map(item => <button type="button" key={item.id} disabled={busy}
        aria-pressed={room.id === item.id} className={`rounded-lg border px-3 py-2 text-sm ${room.id === item.id ? "bg-slate-900 text-white" : "bg-white"}`}
        onClick={() => { setRoomId(item.id); setPlacing(false); setDestination(""); }}>{item.name}</button>)}</div>
      {!preview && <>
        <label className="block text-sm font-semibold">Room name
          <input className="mt-1 w-full rounded-lg border bg-white p-3" value={room.name} maxLength={80} disabled={busy}
            onChange={event => { const name = event.target.value; change(next => { next.scenes.find(item => item.id === room.id)!.name = name;
              next.scenes.forEach(item => item.settings.hotspots.forEach(spot => { if (spot.kind === "scene" && spot.targetSceneId === room.id) spot.label = "Go to " + name; })); }); }} />
        </label>
        <label className="block text-sm">Entrance / first room
          <select className="ml-2 rounded-lg border bg-white p-2" disabled={busy} value={doc.settings.startSceneId || doc.scenes[0]?.id}
            onChange={event => change(next => { next.settings.startSceneId = event.target.value; })}>
            {doc.scenes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {doc.scenes.length > 1 && <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">Doorway leads to <select className="ml-2 rounded-lg border bg-white p-2" value={destination} disabled={busy}
            onChange={event => { setDestination(event.target.value); setPlacing(false); }}>
            <option value="">Choose a room</option>{doc.scenes.filter(item => item.id !== room.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <button type="button" className="rounded-lg bg-blue-900 px-3 py-2 text-sm text-white" disabled={!destination || busy}
            onClick={() => setPlacing(!placing)}>{placing ? "Cancel placement" : "Place doorway arrow"}</button>
        </div>}
        <p className="text-xs text-slate-600">Drag the image to look around. Choose the next room, press Place doorway arrow, then click its doorway. Repeat in the next room for the way back.</p>
      </>}
      <div className="tnp-property-walkthrough overflow-hidden rounded-xl bg-slate-950">
        <TourCanvas scene={room} settings={doc.settings} editMode={!preview} placing={placing && !busy && !preview}
          onPlace={place} onHotspot={spot => { if (preview && spot.targetSceneId) setRoomId(spot.targetSceneId); }} />
      </div>
      {!preview && room.settings.hotspots.filter(spot => spot.kind === "scene").map(spot => <div key={spot.id} className="flex items-center justify-between gap-2 text-sm">
        <span>{spot.label}</span><button type="button" disabled={busy} className="text-red-800 underline"
          onClick={() => change(next => { const current = next.scenes.find(item => item.id === room.id)!; current.settings.hotspots = current.settings.hotspots.filter(item => item.id !== spot.id); })}>Remove arrow</button>
      </div>)}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className="rounded-lg border bg-white px-4 py-3 text-sm" onClick={() => { setPreview(!preview); setPlacing(false); setRoomId(doc.settings.startSceneId || doc.scenes[0]!.id); }}>{preview ? "Back to editing" : "3. Test walkthrough"}</button>
        <button type="button" disabled={busy} className="rounded-lg border bg-white px-4 py-3 text-sm" onClick={() => void persist(false)}>Save progress</button>
        <button type="button" disabled={busy} className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white" onClick={() => void persist(true)}>{busy ? "Working…" : "Publish and select tour"}</button>
      </div>
      <p className="text-xs text-slate-600">{dirty ? "Unsaved tour changes. Save progress before closing this property form." : "Tour progress saved separately from your property."} Publishing lets anyone with the tour link view these rooms. Save the property afterward to attach the selected tour.</p>
    </div>}
    <details className="mt-4 text-xs"><summary className="cursor-pointer text-slate-600">Already have a TNP, Kuula or Matterport tour? Paste its share link</summary>
      <input aria-label="Existing tour URL" className="mt-2 w-full rounded-lg border bg-white p-3" value={value} disabled={busy} onChange={event => onChange(event.target.value)} onBlur={()=>{const external=externalTour(value);if(external)onChange(external.url);}} placeholder="TNP tour URL, Kuula share URL or Matterport show URL" />
    </details>
  </section>;
}
