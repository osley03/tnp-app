import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "./auth";

export const Route = createFileRoute("/admin-signin")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Administrator sign in — TNP" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: AdminSignIn,
});

function AdminSignIn() {
  return <AuthPage adminOnly />;
}
