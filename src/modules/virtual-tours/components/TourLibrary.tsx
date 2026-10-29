import {PropertyPhoto} from './PropertyPhoto';
import {propertyForTour,type LinkedProperty} from '../lib/property-media';
import {TourDashboardLink} from '../components/TourDashboardLink';
import {CaptureGuide} from './CaptureGuide';
import { useRouteContext } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addScenes, normalizeTour } from "../api/tours";
import { tourLink } from "@/lib/tour-links";
import "../tour-studio.css";
export function TourLibrary() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["tnp-tour-library", user.id],
    queryFn: async () => {
      const result = await supabase
        .from("tnp_tours")
        .select("id,title,is_published,visibility,created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      if (result.error)
        throw new Error("Could not load tours. Check your connection and try again.");
      return result.data;
    },
  });
  const linkedProperties=useQuery({queryKey:['tour-library-property-photos',user.id],queryFn:async()=>{
const result=await supabase.from('properties').select('id,title,image_url,tour_url').eq('owner_id',user.id).not('tour_url','is',null);
if(result.error)throw result.error;return result.data as LinkedProperty[];
}});
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !files.length) return;
    setBusy(true);
    setMessage("Uploading panoramas. Keep this page open…");
    const id = crypto.randomUUID();
    let created = false;
    try {
      if (files.length > 100) throw new Error("Choose up to 100 panoramas.");
      const result = await supabase
        .from("tnp_tours")
        .insert({
          id,
          owner_id: user.id,
          title: title.trim(),
          is_published: false,
          visibility: "unlisted",
        });
      if (result.error) throw new Error(result.error.message);
      created = true;
      await addScenes(
        normalizeTour({
          id,
          owner_id: user.id,
          title: title.trim(),
          description: "",
          is_published: false,
          visibility: "unlisted",
          revision: 0,
          settings: {},
          scenes: [],
        }),
        files,
      );
      window.location.assign("/app/landlord/tours/" + id);
    } catch (error) {
      if (created) await supabase.from("tnp_tours").delete().eq("id", id);
      setMessage(error instanceof Error ? error.message : "Upload failed.");
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (
      !window.confirm(
        "Delete this tour and all its uploaded media? This cannot be undone. Unlink it from property listings first.",
      )
    )
      return;
    setBusy(true);
    try {
      const paths: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const result = await supabase.storage
          .from("tnp-panoramas")
          .list(user.id + "/" + id, { limit: 1000, offset });
        if (result.error) throw new Error(result.error.message);
        paths.push(...result.data.map((file) => user.id + "/" + id + "/" + file.name));
        if (result.data.length < 1000) break;
      }
      const result = await supabase.from("tnp_tours").delete().eq("id", id).eq("owner_id", user.id);
      if (result.error) throw new Error(result.error.message);
      for (let i = 0; i < paths.length; i += 100) {
        const deleted = await supabase.storage
          .from("tnp-panoramas")
          .remove(paths.slice(i, i + 100));
        if (deleted.error)
          throw new Error("Tour deleted, but some media could not be removed. Contact support.");
      }
      await query.refetch();
      setMessage("Tour deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete the tour.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="tnp-tour-studio p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5"><TourDashboardLink/></div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
          TNP · Virtual Tour Studio
        </p>
        <h1 className="mt-2 text-3xl font-bold">Your virtual tours</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Create a tour, connect the rooms with hotspots, set up the viewing experience, and
          publish. Copy its TNP URL into the property form.
        </p>
        <CaptureGuide/><form onSubmit={create} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold">Create a tour</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <label>
              Tour title
              <input
                value={title}
                maxLength={120}
                required
                disabled={busy}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Avondale garden flat"
              />
            </label>
            <label>
              Panorama images
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                required
                disabled={busy}
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />
              <small>
                Full spherical 2:1 panoramas · JPEG/PNG/WebP · at least 1024 pixels wide · up to 20 MB each. Large images are resized automatically.
              </small>
            </label>
          </div>
          <button className="tnp-tour-primary mt-3" disabled={busy || !files.length}>
            {busy ? "Working…" : "Upload and open editor"}
          </button>
          <small>
            The tour starts as an unpublished draft. Publish it from the editor when ready.
          </small>
        </form>
        {message && (
          <p role="status" className="tnp-tour-message mt-4 rounded-lg">
            {message}
          </p>
        )}
        <label className="mt-8">
          Search your tours
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title"
          />
        </label>
        {query.isPending ? (
          <p role="status">Loading tours…</p>
        ) : query.error ? (
          <p role="alert" className="text-red-800">
            {query.error.message}
          </p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {query.data
              ?.filter((tour) => tour.title.toLowerCase().includes(search.toLowerCase()))
              .map((tour) => (
                <article key={tour.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-4"><PropertyPhoto imageUrl={propertyForTour(linkedProperties.data||[],tour.id)?.image_url} title={propertyForTour(linkedProperties.data||[],tour.id)?.title||tour.title}/></div>
                  <span className="text-xs font-semibold uppercase text-slate-500">
                    {tour.is_published ? tour.visibility : "Draft"}
                  </span>
                  <h2 className="mt-2 text-xl font-bold">{tour.title}</h2>
                  <p className="my-3 text-xs text-slate-500">
                    {new Date(tour.created_at).toLocaleDateString()}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a className="tnp-tour-button" href={"/app/landlord/tours/" + tour.id}>
                      Edit tour
                    </a>
                    <a
                      className="tnp-tour-button"
                      href={tourLink(tour.id, window.location.origin)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </a>
                    <button disabled={busy} onClick={() => void remove(tour.id)}>
                      Delete
                    </button>
                  </div>
                  {tour.is_published && tour.visibility !== "private" && (
                    <label className="text-xs">
                      Property-form URL
                      <input
                        readOnly
                        value={tourLink(tour.id, window.location.origin)}
                        onFocus={(event) => event.target.select()}
                      />
                    </label>
                  )}
                </article>
              ))}
          </div>
        )}
        {query.data?.length === 0 && (
          <p className="mt-5 text-slate-600">No tours yet. Upload your first panoramas above.</p>
        )}
      </div>
    </main>
  );
}
