import {unreachableRooms} from './walkthrough.ts';
import {
  hotspotSchema,
  type Hotspot,
  type TourDocument,
  type ViewPosition,
} from "../types/index.ts";
export function safeWebUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function newHotspot(position: ViewPosition): Hotspot {
  return hotspotSchema.parse({
    id: crypto.randomUUID(),
    kind: "scene",
    label: "Go to room",
    yaw: position.yaw,
    pitch: position.pitch,
  });
}
export function validateDocument(doc: TourDocument): string[] {
  const errors: string[] = [];
  if (!doc.title.trim() || doc.title.length > 120)
    errors.push("Enter a tour title of 1–120 characters.");
  if (!doc.scenes.length) errors.push("Upload at least one panorama.");
  const ids = new Set(doc.scenes.map((scene) => scene.id));
  if (doc.settings.startSceneId && !ids.has(doc.settings.startSceneId))
    errors.push("Choose an existing starting room.");
  for (const scene of doc.scenes) {
    if (!scene.name.trim() || scene.name.length > 80)
      errors.push("Every room needs a name of 1–80 characters.");
    for (const spot of scene.settings.hotspots) {
      if (spot.kind === "scene" && (!spot.targetSceneId || !ids.has(spot.targetSceneId)))
        errors.push(scene.name + ": choose a destination for " + spot.label + ".");
      if (spot.kind === "scene" && spot.targetSceneId === scene.id && !spot.master)
        errors.push(scene.name + ": a room link must lead to a different room.");
      if (["link", "image", "video"].includes(spot.kind) && !spot.media && !safeWebUrl(spot.url))
        errors.push(
          scene.name + ": enter a valid http/https URL or upload media for " + spot.label + ".",
        );
    }
  }
  if (doc.is_published) { const missing=unreachableRooms(doc); if(missing.length) errors.push("Connect rooms from the entrance and add return arrows before publishing: "+missing.join(", ")); }
  return [...new Set(errors)];
}
export function removeSceneReferences(doc: TourDocument, id: string): TourDocument {
  return {
    ...doc,
    settings: {
      ...doc.settings,
      startSceneId: doc.settings.startSceneId === id ? null : doc.settings.startSceneId,
      floorPins: doc.settings.floorPins.filter((pin) => pin.sceneId !== id),
    },
    scenes: doc.scenes
      .filter((scene) => scene.id !== id)
      .map((scene, scene_order) => ({
        ...scene,
        scene_order,
        settings: {
          ...scene.settings,
          hotspots: scene.settings.hotspots.filter((spot) => spot.targetSceneId !== id),
        },
      })),
  };
}
export function transitionView(
  from: ViewPosition,
  sourceNorth: number,
  targetNorth: number,
  enabled: boolean,
): ViewPosition | null {
  return enabled ? { ...from, yaw: from.yaw + sourceNorth - targetNorth } : null;
}
export function embedCode(id: string, origin: string): string {
  const url = new URL("/tours/" + encodeURIComponent(id), origin);
  url.searchParams.set("embed", "1");
  return (
    '<iframe src="' +
    url.href.replaceAll("&", "&amp;").replaceAll('"', "&quot;") +
    '" title="TNP virtual tour" width="100%" height="600" style="border:0" allow="fullscreen; gyroscope; accelerometer" allowfullscreen loading="lazy"></iframe>'
  );
}

export function videoEmbedUrl(value: string): string | null {
  const safe = safeWebUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  const youtube = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(
    url.hostname,
  );
  if (youtube) {
    const id =
      url.hostname === "youtu.be"
        ? url.pathname.slice(1)
        : url.pathname.startsWith("/embed/")
          ? url.pathname.split("/")[2]
          : url.searchParams.get("v");
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id)
      ? "https://www.youtube-nocookie.com/embed/" + id
      : null;
  }
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(url.hostname)) {
    const id = url.pathname.split("/").filter(Boolean).at(-1);
    return id && /^\d{1,15}$/.test(id) ? "https://player.vimeo.com/video/" + id : null;
  }
  return null;
}
