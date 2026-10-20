import type { TourDocument } from "../types";
export function FloorPlan({
  doc,
  sceneId,
  onScene,
  onPin,
}: {
  doc: TourDocument;
  sceneId: string;
  onScene: (id: string) => void;
  onPin?: (x: number, y: number) => void;
}) {
  if (!doc.settings.floorPlan?.url) return null;
  return (
    <div
      className="tnp-tour-plan"
      onClick={(event) => {
        if (!onPin) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        onPin(
          Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)),
          Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100)),
        );
      }}
    >
      <img src={doc.settings.floorPlan.url} alt="Property floor plan" />
      {doc.settings.floorPins.map((pin) => (
        <button
          key={pin.sceneId}
          type="button"
          aria-label={doc.scenes.find((scene) => scene.id === pin.sceneId)?.name || "Room"}
          aria-pressed={pin.sceneId === sceneId}
          title={doc.scenes.find((scene) => scene.id === pin.sceneId)?.name}
          style={{
            left: pin.x + "%",
            top: pin.y + "%",
            outline: pin.sceneId === sceneId ? "3px solid #c99552" : "none",
          }}
          onClick={(event) => {
            event.stopPropagation();
            onScene(pin.sceneId);
          }}
        >
          ●
        </button>
      ))}
    </div>
  );
}
