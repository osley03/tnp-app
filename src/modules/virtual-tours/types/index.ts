import { z } from "zod";
export const mediaSchema = z.object({ path: z.string().max(1024), url: z.string().optional() });
export const hotspotSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["scene", "info", "link", "image", "video"]),
  label: z.string().min(1).max(100),
  body: z.string().max(4000).default(""),
  url: z.string().max(2048).default(""),
  media: mediaSchema.nullable().default(null),
  customIcon: mediaSchema.nullable().default(null),
  yaw: z.number().finite(),
  pitch: z
    .number()
    .min(-Math.PI / 2)
    .max(Math.PI / 2),
  targetSceneId: z.string().uuid().nullable().default(null),
  targetYaw: z.number().nullable().default(null),
  targetPitch: z.number().nullable().default(null),
  icon: z.enum(["arrow", "door", "info", "play", "image"]).default("arrow"),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#c99552"),
  scale: z.number().min(0.5).max(3).default(1),
  opacity: z.number().min(0.1).max(1).default(1),
  rotation: z.number().min(-360).max(360).default(0),
  pulse: z.boolean().default(false),
  master: z.boolean().default(false),
});
export const sceneSettingsSchema = z.object({
  yaw: z.number().default(0),
  pitch: z.number().min(-1.57).max(1.57).default(0),
  zoom: z.number().min(0).max(100).default(0),
  northOffset: z.number().default(0),
  brightness: z.number().min(0.5).max(1.5).default(1),
  contrast: z.number().min(0.5).max(1.5).default(1),
  saturation: z.number().min(0).max(2).default(1),
  hotspots: z.array(hotspotSchema).max(100).default([]),
});
export const tourSettingsSchema = z.object({
  startSceneId: z.string().uuid().nullable().default(null),
  transition: z.enum(["fade", "zoom", "none"]).default("fade"),
  walkthrough: z.boolean().default(true),
  autorotate: z.boolean().default(false),
  rotateSpeed: z.number().min(0.1).max(4).default(0.5),
  showThumbnails: z.boolean().default(true),
  showTitle: z.boolean().default(true),
  showFloorPlan: z.boolean().default(true),
  themeColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#c99552"),
  logo: mediaSchema.nullable().default(null),
  audio: mediaSchema.nullable().default(null),
  floorPlan: mediaSchema.nullable().default(null),
  floorPins: z
    .array(
      z.object({
        sceneId: z.string().uuid(),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
      }),
    )
    .max(100)
    .default([]),
});
export type MediaRef = z.infer<typeof mediaSchema>;
export type Hotspot = z.infer<typeof hotspotSchema>;
export type SceneSettings = z.infer<typeof sceneSettingsSchema>;
export type TourSettings = z.infer<typeof tourSettingsSchema>;
export type TourScene = {
  id: string;
  tour_id: string;
  name: string;
  panorama_url: string;
  storage_path: string;
  scene_order: number;
  settings: SceneSettings;
};
export type TourDocument = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  visibility: "public" | "unlisted" | "private" | "password";
  is_published: boolean;
  revision: number;
  settings: TourSettings;
  scenes: TourScene[];
};
export type ViewPosition = { yaw: number; pitch: number; zoom: number };
export const defaultTourSettings = () => tourSettingsSchema.parse({});
export const defaultSceneSettings = () => sceneSettingsSchema.parse({});
