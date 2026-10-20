import { createFileRoute } from "@tanstack/react-router";
import { SharedTourPage } from "@/modules/virtual-tours/viewer/SharedTourPage";
export const Route = createFileRoute("/tours/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "360° Property Tour — TNP" }] }),
  component: Tour,
});
function Tour() {
  const { id } = Route.useParams();
  return <SharedTourPage key={id} id={id} />;
}
