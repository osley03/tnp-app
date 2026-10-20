import type { Hotspot, TourDocument, ViewPosition } from "../types";
import { AssetUpload } from "./AssetUpload";
export function HotspotInspector({
  doc,
  sceneId,
  spot,
  position,
  onChange,
  onDelete,
  onMove,
  onBacklink,
  onDuplicate,
}: {
  doc: TourDocument;
  sceneId: string;
  spot: Hotspot;
  position: ViewPosition;
  onChange: (spot: Hotspot) => void;
  onDelete: () => void;
  onMove: () => void;
  onBacklink: () => void;
  onDuplicate: () => void;
}) {
  function update<K extends keyof Hotspot>(key: K, value: Hotspot[K]) {
    onChange({ ...spot, [key]: value });
  }
  return (
    <section>
      <h2>Hotspot settings</h2>
      <label>
        Action
        <select
          value={spot.kind}
          onChange={(event) => update("kind", event.target.value as Hotspot["kind"])}
        >
          <option value="scene">Go to another room</option>
          <option value="info">Information card</option>
          <option value="link">Open website</option>
          <option value="image">Image card</option>
          <option value="video">Video card</option>
        </select>
      </label>
      <label>
        Label
        <input
          value={spot.label}
          maxLength={100}
          onChange={(event) => update("label", event.target.value)}
        />
      </label>
      {spot.kind === "scene" ? (
        <>
          <label>
            Destination room
            <select
              value={spot.targetSceneId || ""}
              onChange={(event) => update("targetSceneId", event.target.value || null)}
            >
              <option value="">Choose room</option>
              {doc.scenes
                .filter((scene) => scene.id !== sceneId)
                .map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.name}
                  </option>
                ))}
            </select>
          </label>
          <button type="button" disabled={!spot.targetSceneId} onClick={onBacklink}>
            Add return link in destination
          </button>
          <label>
            Arrival orientation
            <select
              value={spot.targetYaw === null ? "walkthrough" : "fixed"}
              onChange={(event) =>
                onChange({
                  ...spot,
                  targetYaw: event.target.value === "fixed" ? 0 : null,
                  targetPitch: event.target.value === "fixed" ? 0 : null,
                })
              }
            >
              <option value="walkthrough">Preserve walking direction</option>
              <option value="fixed">Specific arrival view</option>
            </select>
          </label>
          {spot.targetYaw !== null && (
            <>
              <label>
                Arrival yaw (degrees)
                <input
                  type="number"
                  value={Math.round((spot.targetYaw * 180) / Math.PI)}
                  onChange={(event) =>
                    update("targetYaw", (Number(event.target.value) * Math.PI) / 180)
                  }
                />
              </label>
              <label>
                Arrival pitch (degrees)
                <input
                  type="number"
                  min={-89}
                  max={89}
                  value={Math.round(((spot.targetPitch || 0) * 180) / Math.PI)}
                  onChange={(event) =>
                    update(
                      "targetPitch",
                      (Math.max(-89, Math.min(89, Number(event.target.value))) * Math.PI) / 180,
                    )
                  }
                />
              </label>
            </>
          )}
        </>
      ) : (
        <>
          <label>
            Card text
            <textarea
              rows={4}
              maxLength={4000}
              value={spot.body}
              onChange={(event) => update("body", event.target.value)}
            />
          </label>
          {spot.kind !== "info" && (
            <label>
              {spot.kind === "link" ? "Website URL" : "Media URL (or upload below)"}
              <input
                type="url"
                value={spot.url}
                onChange={(event) => update("url", event.target.value)}
                placeholder="https://..."
              />
            </label>
          )}
          {["image", "video"].includes(spot.kind) && (
            <AssetUpload
              key={spot.id + spot.kind}
              label="Upload card media"
              kind={spot.kind as "image" | "video"}
              value={spot.media}
              ownerId={doc.owner_id}
              tourId={doc.id}
              onChange={(media) => update("media", media)}
            />
          )}
        </>
      )}
      <h3>Appearance</h3>
      <AssetUpload
        label="Custom hotspot icon"
        ownerId={doc.owner_id}
        tourId={doc.id}
        value={spot.customIcon}
        onChange={(media) => update("customIcon", media)}
      />
      <label>
        Icon
        <select
          value={spot.icon}
          onChange={(event) => update("icon", event.target.value as Hotspot["icon"])}
        >
          <option value="arrow">Arrow</option>
          <option value="door">Doorway</option>
          <option value="info">Information</option>
          <option value="play">Play</option>
          <option value="image">Image</option>
        </select>
      </label>
      <label>
        Colour
        <input
          type="color"
          value={spot.color}
          onChange={(event) => update("color", event.target.value)}
        />
      </label>
      <label>
        Size: {spot.scale.toFixed(1)}×
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={spot.scale}
          onChange={(event) => update("scale", Number(event.target.value))}
        />
      </label>
      <label>
        Opacity
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.1}
          value={spot.opacity}
          onChange={(event) => update("opacity", Number(event.target.value))}
        />
      </label>
      <label>
        Icon rotation
        <input
          type="range"
          min={-180}
          max={180}
          value={spot.rotation}
          onChange={(event) => update("rotation", Number(event.target.value))}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={spot.pulse}
          onChange={(event) => update("pulse", event.target.checked)}
        />
        Pulse animation
      </label>
      <label>
        <input
          type="checkbox"
          checked={spot.master}
          onChange={(event) => update("master", event.target.checked)}
        />
        Show on every scene (master hotspot)
      </label>
      <div className="tnp-tour-row">
        <button type="button" onClick={onMove}>
          Place again
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...spot, yaw: position.yaw, pitch: position.pitch })}
        >
          Move to view centre
        </button>
      </div>
      <div className="tnp-tour-row mt-3">
        <button type="button" onClick={onDuplicate}>
          Duplicate
        </button>
        <button type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
    </section>
  );
}
