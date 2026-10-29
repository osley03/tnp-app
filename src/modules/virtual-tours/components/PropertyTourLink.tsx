import { useState } from "react";
import { externalTour } from "@/lib/external-tours";
import { tourIdFromUrl, tourLink } from "@/lib/tour-links";
import { PropertyPhoto } from "./PropertyPhoto";
import { TourDashboardLink } from "./TourDashboardLink";
export function PropertyTourLink({
  value,
  imageUrl,
  propertyTitle,
  propertyId,
}: {
  value: string;
  imageUrl?: string | null | undefined;
  propertyTitle?: string | undefined;
  propertyId?: string | undefined;
}) {
  const [loaded, setLoaded] = useState("");
  const id = tourIdFromUrl(value, window.location.origin),
    external = externalTour(value);
  if (!id && !external) return null;
  const href = id
    ? tourLink(id, window.location.origin) +
      (propertyId ? "?property=" + encodeURIComponent(propertyId) : "")
    : "";
  return (
    <section
      id="property-virtual-tour"
      className="tnp-payment-paper rounded-xl border bg-white p-4 text-slate-950"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">360° property tour</h2>
        <TourDashboardLink />
      </div>
      <div
        className={
          propertyTitle || imageUrl
            ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
            : ""
        }
      >
        {(propertyTitle || imageUrl) && (
          <PropertyPhoto
            imageUrl={imageUrl}
            title={propertyTitle || "Property photo"}
          />
        )}
        <div className="min-w-0">
          {id ? (
            <>
              <p className="mb-3 text-sm text-slate-600">
                Explore the rooms using doorway hotspots. Your primary listing
                photo is shown alongside the tour.
              </p>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl bg-amber-200 p-3 text-center font-semibold text-slate-950"
              >
                View 360° property tour
              </a>
            </>
          ) : (
            external && (
              <>
                <p className="mb-3 text-sm">
                  This tour is hosted by {external.provider}. Loading it
                  connects your browser to that provider. Availability and
                  access are managed by the tour owner.
                </p>
                {loaded === external.url ? (
                  <iframe
                    title={external.provider + " property tour"}
                    src={external.url}
                    className="h-[420px] w-full rounded-lg border sm:h-[560px]"
                    loading="lazy"
                    allowFullScreen
                    allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer"
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                    onClick={() => setLoaded(external.url)}
                  >
                    Load external 360° tour
                  </button>
                )}
                <a
                  href={external.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block text-sm underline"
                >
                  Open on {external.provider} if the embedded tour is
                  unavailable
                </a>
              </>
            )
          )}
        </div>
      </div>
    </section>
  );
}
