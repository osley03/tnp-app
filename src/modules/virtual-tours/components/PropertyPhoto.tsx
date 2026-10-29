import { PropertyImage } from "@/components/properties/PropertyImage";
export function PropertyPhoto({
  imageUrl,
  title,
}: {
  imageUrl?: string | null | undefined;
  title: string;
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-950">
      <PropertyImage imageUrl={imageUrl} title={title} />
      <figcaption className="p-3 text-sm font-semibold">
        {title || "Property photo"}
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Exterior property photo
        </span>
      </figcaption>
    </figure>
  );
}
