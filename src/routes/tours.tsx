import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { PublicTourGallery } from "@/modules/virtual-tours/viewer/PublicTourGallery";
export const Route = createFileRoute("/tours")({ ssr: false, component: Tours });
function Tours() {
  const location = useLocation();
  return location.pathname.replace(/\/$/, "") === "/tours" ? <PublicTourGallery /> : <Outlet />;
}
