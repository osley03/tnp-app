import type { TourDocument } from "../types";

/** Every room must be reachable from the entrance and able to return to it. */
export function unreachableRooms(doc: TourDocument): string[] {
  const start = doc.settings.startSceneId || doc.scenes[0]?.id;
  if (!start) return [];
  function visit(reverse: boolean) {
    const seen = new Set<string>();
    const queue = [start!];
    while (queue.length) {
      const id = queue.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const room of doc.scenes) for (const spot of room.settings.hotspots) {
        if (spot.kind !== "scene" || !spot.targetSceneId) continue;
        if (!reverse && room.id === id) queue.push(spot.targetSceneId);
        if (reverse && spot.targetSceneId === id) queue.push(room.id);
      }
    }
    return seen;
  }
  const forward = visit(false), backward = visit(true);
  return doc.scenes.filter(room => !forward.has(room.id) || !backward.has(room.id)).map(room => room.name);
}
