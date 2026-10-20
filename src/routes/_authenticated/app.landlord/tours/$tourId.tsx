import { createFileRoute } from "@tanstack/react-router";
import { TourEditor } from "@/modules/virtual-tours/editor/TourEditor";
export const Route = createFileRoute("/_authenticated/app/landlord/tours/$tourId")({
  component: Editor,
});
function Editor() {
  const { tourId } = Route.useParams();
  return <TourEditor key={tourId} id={tourId} />;
}
