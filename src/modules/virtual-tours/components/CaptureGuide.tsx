import { useEffect, useState } from "react";
import { normalizeTour, preparePanorama, validatePanorama } from "../api/tours";
import { TourCanvas } from "../viewer/TourCanvas";
export function CaptureGuide() {
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const preview = url
    ? normalizeTour({
        id: "local-preview",
        owner_id: "local-preview",
        title: "Local image check",
        is_published: false,
        settings: {},
        scenes: [
          {
            id: "local-room",
            name: "Your image preview",
            panorama_url: url,
            storage_path: "",
            scene_order: 0,
            settings: {},
          },
        ],
      })
    : null;
  return (
    <details className="my-5 rounded-xl border border-slate-300 bg-white p-4 text-slate-950">
      <summary className="cursor-pointer font-semibold">
        How to capture room photos · check an image before uploading
      </summary>
      <p className="mt-3 text-sm">
        Use one full spherical 360° photo per room, exported as an equirectangular image with a 2:1
        width-to-height ratio. For example, 4096 × 2048. A normal photo stretched or cropped to 2:1
        is not a full sphere.
      </p>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm">
        <li>
          <strong>Capture.</strong> Use a 360° camera or a capture service. With a phone, use a tool
          that explicitly captures and exports a full spherical Photo Sphere, including ceiling and
          floor. Ordinary Panorama mode is not sufficient. TNP does not stitch camera shots into a
          sphere.
        </li>
        <li>
          <strong>Position.</strong> Place the camera in a safe central position around chest
          height. Open internal doors, turn on lights and keep people, private documents and mirrors
          with personal details out of frame. Keep the camera still during capture.
        </li>
        <li>
          <strong>Export.</strong> In the camera app, stitch/export a full 360° JPEG rather than a
          flat screenshot or dual-fisheye image. Name files Living room, Kitchen, Bedroom 1 and so
          on. TNP accepts JPEG, PNG or WebP up to 20 MB each; JPEG is usually smaller.
        </li>
        <li>
          <strong>Connect.</strong> Upload the rooms, choose the entrance, then place an arrow on
          each doorway and choose the destination room. Add a return arrow in the next room. Test
          every room before publishing.
        </li>
        <li>
          <strong>Attach.</strong> Publish and select the tour, then save the property. Tenants open
          the listing’s tour and use its doorway arrows. The standalone studio also gives you a
          shareable TNP link.
        </li>
      </ol>
      <p className="mt-4 text-sm">
        If your Android camera only offers a wide panorama, use another capture method above. Do not
        rely on old instructions to install the discontinued standalone Google Street View capture
        app.
      </p>
      <label className="mt-4 block text-sm font-semibold">
        Check a room image locally
        <input
          type="file"
          disabled={busy}
          accept="image/jpeg,image/png,image/webp"
          className="mt-2 block w-full rounded-lg border bg-white p-3"
          onChange={async (e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (!file) return;
            setBusy(true);
            setMessage("Checking image size…");
            setUrl("");
            try {
              const size = await validatePanorama(file);
              setUrl(URL.createObjectURL(await preparePanorama(file)));
              setMessage(
                "Size check passed: " +
                  size.width +
                  " × " +
                  size.height +
                  ". Look up, down and around below. Confirm the whole room is captured; dimensions alone cannot prove that.",
              );
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "This image could not be checked.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <p className="mt-2 text-xs">
        This check stays in your browser. It does not upload, save or publish your image.
      </p>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
      {preview && (
        <div className="mt-4 overflow-hidden rounded-xl">
          <TourCanvas scene={preview.scenes[0]!} settings={preview.settings} onHotspot={() => {}} />
        </div>
      )}
    </details>
  );
}
