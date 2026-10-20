const TOUR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function tourIdFromUrl(value: string, origin: string): string | null {
  try {
    const url = new URL(value, origin);
    if (url.origin !== new URL(origin).origin || !["http:", "https:"].includes(url.protocol))
      return null;
    const match = /^\/tours\/([^/]+)\/?$/.exec(url.pathname);
    return match?.[1] && TOUR_ID.test(match[1]) && !url.search && !url.hash ? match[1] : null;
  } catch {
    return null;
  }
}
export function tourLink(id: string, origin: string): string {
  if (!TOUR_ID.test(id)) throw new Error("Invalid tour ID.");
  return new URL("/tours/" + id, origin).href;
}
