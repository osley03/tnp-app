export type LinkedProperty = {
  id: string;
  title: string;
  image_url: string | null;
  tour_url: string | null;
};
export function propertyForTour(
  rows: LinkedProperty[],
  tourId: string,
  propertyId: string | null = null,
): LinkedProperty | null {
  const linked = rows.filter((row) => {
    try {
      return (
        new URL(row.tour_url || "").pathname.replace(/\/$/, "") ===
        "/tours/" + tourId
      );
    } catch {
      return false;
    }
  });
  return propertyId
    ? linked.find((row) => row.id.toLowerCase() === propertyId.toLowerCase()) || null
    : linked.find((row) => row.image_url) || linked[0] || null;
}
