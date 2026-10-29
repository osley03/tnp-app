import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { PropertyPhoto } from "./PropertyPhoto";
import { propertyForTour, type LinkedProperty } from "../lib/property-media";
export function PropertyTourLayout({
  tourId,
  embed,
  children,
}: {
  tourId: string;
  embed: boolean;
  children: ReactNode;
}) {
  const { user } = useSession();
  const propertyId = new URLSearchParams(window.location.search).get(
    "property",
  );
  const query = useQuery({
    queryKey: ["tour-primary-property-photo", tourId, user?.id, propertyId],
    enabled: !!user && !embed,
    queryFn: async () => {
      let request = supabase
        .from("properties")
        .select("id,title,image_url,tour_url")
        .ilike("tour_url", "%/tours/" + tourId + "%");
      if (propertyId) request = request.eq("id", propertyId);
      const result = await request.limit(30);
      if (result.error) throw result.error;
      return propertyForTour(
        result.data as LinkedProperty[],
        tourId,
        propertyId,
      );
    },
  });
  const property = query.data;
  return (
    <>
      <div
        className={
          property && !embed
            ? "grid items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
            : ""
        }
      >
        {property && !embed && (
          <PropertyPhoto imageUrl={property.image_url} title={property.title} />
        )}
        <div className="min-w-0">{children}</div>
      </div>
      {query.error && !embed && (
        <p role="alert" className="p-4 text-sm text-white">
          The primary listing photo could not load.{" "}
          <button className="underline" onClick={() => query.refetch()}>
            Retry photo
          </button>
        </p>
      )}
    </>
  );
}
