import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { TourLibrary } from "@/modules/virtual-tours/components/TourLibrary";
export const Route = createFileRoute("/_authenticated/app/landlord/tours")({ component: Tours });
function Tours() {
  const location = useLocation();
  return location.pathname.replace(/\/$/, "") === "/app/landlord/tours" ? (
    <TourLibrary />
  ) : (
    <Outlet />
  );
}
