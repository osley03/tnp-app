import { useState } from "react";
import { propertyImageUrl } from "@/lib/property-image-url";
export function PropertyImage({
  imageUrl,
  title,
  className = "aspect-[4/3] w-full",
}: {
  imageUrl?: string | null | undefined;
  title: string;
  className?: string | undefined;
}) {
  const url = propertyImageUrl(imageUrl),
    [failed, setFailed] = useState("");
  return (
    <div className={"relative overflow-hidden bg-slate-100 " + className}>
      {url && failed !== url ? (
        <img
          src={url}
          alt={title + " — exterior property photo"}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="h-full w-full object-contain"
          onError={() => setFailed(url)}
        />
      ) : (
        <div
          role="img"
          aria-label="Exterior photo unavailable"
          className="flex h-full min-h-32 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-slate-600"
        >
          <span>
            {url
              ? "Exterior photo could not load."
              : "No exterior photo added yet."}
          </span>
          {url && (
            <button
              type="button"
              className="rounded border px-3 py-2 text-xs font-semibold"
              onClick={() => setFailed("")}
            >
              Retry photo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
