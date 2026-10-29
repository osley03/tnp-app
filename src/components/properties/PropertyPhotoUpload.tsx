import { useId, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkExteriorPhoto } from "@/lib/property-image-url";
export function PropertyPhotoUpload({
  onUploaded,
  onBusyChange,
}: {
  onUploaded: (url: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const id = useId(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function upload(file: File) {
    setMessage("");
    setBusy(true);
    onBusyChange(true);
    let bitmap: ImageBitmap | undefined;
    try {
      checkExteriorPhoto(file);
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 40000000)
        throw new Error("Choose a photo of at most 40 megapixels.");
      const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Photo processing is unavailable.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("Photo processing failed.")),
          "image/jpeg",
          0.88,
        ),
      );
      bitmap.close();
      bitmap = undefined;
      const auth = await supabase.auth.getUser();
      if (auth.error || !auth.data.user)
        throw new Error("Sign in again before uploading.");
      const objectPath = auth.data.user.id + "/" + crypto.randomUUID() + ".jpg";
      const saved = await supabase.storage
        .from("tnp-property-photos")
        .upload(objectPath, blob, { contentType: "image/jpeg", upsert: false });
      if (saved.error) throw new Error(saved.error.message);
      const { data } = supabase.storage
        .from("tnp-property-photos")
        .getPublicUrl(objectPath);
      onUploaded(data.publicUrl);
      setMessage(
        "Exterior photo uploaded. Save the property to apply it to the listing and tour.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to upload the photo.",
      );
    } finally {
      bitmap?.close();
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <label htmlFor={id} className="block text-sm font-bold text-slate-900">
        Upload exterior property photo
      </label>
      <p className="my-2 text-xs text-slate-600">
        Choose a full outside view of the house. JPG, PNG or WebP, up to 10 MB.
        This photo will be publicly visible on your listing.
      </p>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        className="block w-full text-sm text-slate-900"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      {busy && (
        <p role="status" className="mt-2 text-sm text-slate-700">
          Uploading exterior photo…
        </p>
      )}
      {message && (
        <p role="status" className="mt-2 text-sm text-slate-700">
          {message}
        </p>
      )}
    </div>
  );
}
