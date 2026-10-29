import {TourDashboardLink} from '../components/TourDashboardLink';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import "../tour-studio.css";
export function PublicTourGallery() {
  const query = useQuery({
    queryKey: ["public-tnp-tours"],
    queryFn: async () => {
      const result = await supabase
        .from("tnp_tours")
        .select("id,title,description")
        .eq("visibility", "public")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (result.error) throw new Error("Tours could not load. Please try again.");
      return result.data;
    },
  });
  return (
    <main className="tnp-tour-studio p-5 sm:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5"><TourDashboardLink/></div>
        <a href="/" className="font-bold">
          TNP · Home
        </a>
        <h1 className="mt-8 text-3xl font-bold">Explore public virtual tours</h1>
        <p className="mt-3 text-slate-600">Look around properties before arranging a viewing.</p>
        {query.isPending ? (
          <p className="mt-8">Loading tours…</p>
        ) : query.error ? (
          <p role="alert" className="mt-8">
            {query.error.message}
          </p>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {query.data?.map((tour) => (
              <a
                key={tour.id}
                href={"/tours/" + tour.id}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <span className="text-xs font-bold text-amber-800">360° VIRTUAL TOUR</span>
                <h2 className="mt-3 text-xl font-bold">{tour.title}</h2>
                <p className="mt-3 line-clamp-3 text-sm text-slate-600">{tour.description}</p>
                <p className="mt-5 font-semibold">Explore rooms →</p>
              </a>
            ))}
          </div>
        )}
        {query.data?.length === 0 && <p className="mt-8">There are no public tours yet.</p>}
      </div>
    </main>
  );
}
