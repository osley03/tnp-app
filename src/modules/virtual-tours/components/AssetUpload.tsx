import { useState } from "react";
import { uploadAsset } from "../api/tours";
import type { MediaRef } from "../types";
export function AssetUpload({
  label,
  value,
  ownerId,
  tourId,
  kind = "image",
  onChange,
}: {
  label: string;
  value: MediaRef | null;
  ownerId: string;
  tourId: string;
  kind?: "image" | "audio" | "video";
  onChange: (media: MediaRef | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <label>
        {label}
        <input
          type="file"
          disabled={busy}
          accept={
            kind === "audio"
              ? "audio/mpeg,audio/mp4,audio/wav,audio/ogg"
              : kind === "video"
                ? "video/mp4,video/webm"
                : "image/jpeg,image/png,image/webp"
          }
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              onChange(await uploadAsset(ownerId, tourId, file, kind));
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Upload failed");
            } finally {
              setBusy(false);
              event.target.value = "";
            }
          }}
        />
      </label>
      {busy && <p role="status">Uploading…</p>}
      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}
      {value && (
        <div>
          {kind === "image" && value.url ? (
            <img src={value.url} alt={label} className="max-h-28 rounded-lg" />
          ) : (
            <p className="break-all text-xs">{value.path.split("/").pop()}</p>
          )}
          <button type="button" onClick={() => onChange(null)}>
            Remove from tour
          </button>
        </div>
      )}
    </div>
  );
}
