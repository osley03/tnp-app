import { useState } from "react";
export function PropertyPhoto({
  imageUrl,
  title,
}: {
  imageUrl?: string | null | undefined;
  title: string;
}) {
  const [failed, setFailed] = useState("");
  let url = "";
  try {
    const value = new URL(imageUrl || "");
    if (
      ["http:", "https:"].includes(value.protocol) &&
      !value.username &&
      !value.password
    )
      url = value.href;
  } catch {}
  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-950">
      {url && failed !== url ? (
        <img
          src={url}
          alt={title + " — primary property photo"}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover"
          onError={() => setFailed(url)}
        />
      ) : (
        <div className="grid aspect-[4/3] place-items-center bg-slate-100 p-5 text-center text-sm text-slate-600">
          {url
            ? "Property photo unavailable. Check the primary image URL."
            : "No primary property photo provided."}
        </div>
      )}
      <figcaption className="p-3 text-sm font-semibold">
        {title || "Property photo"}
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Primary listing photo
        </span>
      </figcaption>
    </figure>
  );
}
