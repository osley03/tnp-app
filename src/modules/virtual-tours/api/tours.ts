import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  sceneSettingsSchema,
  tourSettingsSchema,
  type TourDocument,
  type MediaRef,
} from "../types";
import { validateDocument } from "../lib/model";

type RpcResult = { data: unknown; error: { message: string } | null };
async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const result = await (
    supabase.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<RpcResult>
  )(name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export function normalizeTour(raw: unknown): TourDocument {
  const value = raw as TourDocument;
  return {
    ...value,
    description: value.description || "",
    revision: value.revision || 0,
    visibility: value.visibility || "public",
    settings: tourSettingsSchema.parse(value.settings ?? {}),
    scenes: (value.scenes || []).map((scene) => ({
      ...scene,
      settings: sceneSettingsSchema.parse(scene.settings ?? {}),
    })),
  };
}
function mediaRefs(doc: TourDocument): MediaRef[] {
  return [
    doc.settings.logo,
    doc.settings.audio,
    doc.settings.floorPlan,
    ...doc.scenes.flatMap((scene) =>
      scene.settings.hotspots.flatMap((spot) => [spot.media, spot.customIcon]),
    ),
  ].filter((item): item is MediaRef => Boolean(item));
}
export async function loadEditor(id: string): Promise<TourDocument> {
  const [tour, scenes] = await Promise.all([
    supabase.from("tnp_tours").select("*").eq("id", id).single(),
    supabase.from("tnp_tour_scenes").select("*").eq("tour_id", id).order("scene_order"),
  ]);
  if (tour.error || scenes.error)
    throw new Error(tour.error?.message || scenes.error?.message || "Could not load the tour.");
  const doc = normalizeTour({ ...tour.data, scenes: scenes.data });
  const paths = [
    ...new Set(
      [
        ...doc.scenes.map((scene) => scene.storage_path),
        ...mediaRefs(doc).map((ref) => ref.path),
      ].filter(Boolean),
    ),
  ];
  if (paths.length) {
    const signed = await supabase.storage.from("tnp-panoramas").createSignedUrls(paths, 3600);
    if (signed.error) throw new Error(signed.error.message);
    if (signed.data?.some(item => item.error || !item.signedUrl))
      throw new Error("Some room images could not be opened. Check that the panorama files still exist in this tour's storage folder.");
    const urls = new Map((signed.data || []).map((item) => [item.path, item.signedUrl]));
    doc.scenes.forEach((scene) => {
      scene.panorama_url = urls.get(scene.storage_path) || "";
    });
    mediaRefs(doc).forEach((ref) => {
      ref.url = urls.get(ref.path) || "";
    });
  }
  return doc;
}
export async function readSharedTour(id: string, password: string): Promise<TourDocument> {
  const { data, error } = await supabase.functions.invoke("virtual-tours", {
    body: { tourId: id, password },
  });
  if (error) {
    let message = "Tour unavailable. Check your connection or contact the property owner.";
    if ("context" in error && error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      if (body?.error) message = body.error;
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return normalizeTour(data);
}
export async function saveTour(doc: TourDocument, password: string | null): Promise<number> {
  const errors = validateDocument(doc);
  if (errors.length) throw new Error(errors.join("\n"));
  const clean = structuredClone(doc);
  mediaRefs(clean).forEach((ref) => {
    delete ref.url;
  });
  const result = await rpc("tnp_save_tour", {
    p_id: doc.id,
    p_revision: doc.revision,
    p_title: doc.title.trim(),
    p_description: doc.description,
    p_visibility: doc.visibility,
    p_published: doc.is_published,
    p_settings: clean.settings as unknown as Json,
    p_scenes: clean.scenes.map((scene) => ({
      id: scene.id,
      name: scene.name.trim(),
      scene_order: scene.scene_order,
      settings: scene.settings,
    })) as unknown as Json,
    p_password: password,
  });
  return Number(result);
}
export async function validatePanorama(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024)
    throw new Error(`${file.name}: choose a JPEG, PNG or WebP of at most 20 MB. Export HEIC photos as JPEG first.`);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch { throw new Error(`${file.name}: this image could not be opened. Export it as JPEG and retry.`); }
    if (image.width < 1024 || Math.abs(image.width / image.height - 2) > 0.05)
      throw new Error(`${file.name} is ${image.width} × ${image.height}. A full 360° room image must be twice as wide as it is high (for example 4096 × 2048), at least 1024 pixels wide. A wide phone panorama or normal photo is not a full spherical panorama.`);
    return { width: image.width, height: image.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function preparePanorama(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (image.width <= 4096 && file.type === "image/jpeg" && file.size <= 2 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas"); canvas.width = Math.min(4096, image.width); canvas.height = Math.round(canvas.width / 2);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this panorama. Export an 4096 × 2048 JPEG and retry.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.87));
    if (!blob) throw new Error("Could not resize this panorama. Export an 4096 × 2048 JPEG and retry.");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally { URL.revokeObjectURL(url); }
}
export async function uploadAsset(
  ownerId: string,
  tourId: string,
  file: File,
  kind: "image" | "audio" | "video" = "image",
): Promise<MediaRef> {
  const allowed =
    kind === "audio"
      ? ["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg"]
      : kind === "video"
        ? ["video/mp4", "video/webm"]
        : ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type) || file.size > 20 * 1024 * 1024)
    throw new Error("Choose supported media of at most 20 MB.");
  const ext =
    file.name
      .split(".")
      .pop()
      ?.replace(/[^a-z0-9]/gi, "")
      .slice(0, 8) || "media";
  const path = ownerId + "/" + tourId + "/" + crypto.randomUUID() + "." + ext;
  const uploaded = await supabase.storage
    .from("tnp-panoramas")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploaded.error) throw new Error(uploaded.error.message);
  const signed = await supabase.storage.from("tnp-panoramas").createSignedUrl(path, 3600);
  if (signed.error) {
    await supabase.storage.from("tnp-panoramas").remove([path]);
    throw new Error(signed.error.message);
  }
  return { path, url: signed.data.signedUrl };
}
export async function addScenes(doc: TourDocument, files: File[]) {
  if (doc.scenes.length + files.length > 100)
    throw new Error("A tour can contain up to 100 scenes.");
  for (const file of files) await validatePanorama(file);
  const paths: string[] = [];
  const rows: Array<{
    id: string;
    tour_id: string;
    name: string;
    panorama_url: string;
    storage_path: string;
    scene_order: number;
  }> = [];
  try {
    for (const file of files) {
      const media = await uploadAsset(doc.owner_id, doc.id, await preparePanorama(file));
      paths.push(media.path);
      rows.push({
        id: crypto.randomUUID(),
        tour_id: doc.id,
        name: file.name.replace(/\.[^.]+$/, "").trim().slice(0, 80) || "Room " + (doc.scenes.length + rows.length + 1),
        panorama_url: media.url || "",
        storage_path: media.path,
        scene_order: doc.scenes.length + rows.length,
      });
    }
    const result = await supabase.from("tnp_tour_scenes").insert(rows);
    if (result.error) throw new Error(result.error.message);
  } catch (error) {
    if (paths.length) await supabase.storage.from("tnp-panoramas").remove(paths);
    throw error;
  }
}
export async function listMembers(id: string): Promise<Array<{ viewer_id: string }>> {
  return (await rpc("tnp_tour_members", { p_id: id, p_viewer: null, p_remove: false })) as Array<{
    viewer_id: string;
  }>;
}
export async function changeMember(id: string, viewer: string, remove = false) {
  return rpc("tnp_tour_members", { p_id: id, p_viewer: viewer, p_remove: remove });
}
export async function viewCount(id: string): Promise<number> {
  return Number(await rpc("tnp_tour_view_count", { p_id: id }));
}
