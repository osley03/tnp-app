export function propertyImageUrl(value: string | null | undefined): string {
  try {
    const u = new URL((value || "").trim());
    return ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export function checkExteriorPhoto(file: Pick<File, "type" | "size">): void {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPG, PNG or WebP exterior photo.");
  if (!file.size || file.size > 10485760)
    throw new Error("Choose a photo smaller than 10 MB.");
}
export async function verifyPropertyImage(value: string): Promise<void> {
  const url = propertyImageUrl(value);
  if (!url)
    throw new Error(
      "Upload an exterior property photo or enter a direct image URL.",
    );
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => {
      image.src = "";
      reject(
        new Error(
          "The photo did not load. Upload it directly or use a working image URL.",
        ),
      );
    }, 12000);
    image.referrerPolicy = "no-referrer";
    image.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(
        new Error(
          "That address does not load a photo. Upload the exterior photo or paste a direct image URL, not a website or search page.",
        ),
      );
    };
    image.src = url;
  });
}
