import type { MouseEventHandler } from "react";
import { ArrowLeft } from "lucide-react";
import { useSession, roleHome } from "@/lib/session";
export function TourDashboardLink({
  onClick,
}: { onClick?: MouseEventHandler<HTMLAnchorElement> } = {}) {
  const { role, loading } = useSession();
  if (loading) return null;
  return (
    <a
      onClick={onClick}
      href={role ? roleHome(role) : "/auth?mode=signin"}
      className="inline-flex items-center gap-2 rounded-lg border border-current/20 px-3 py-2 text-sm font-semibold"
    >
      <ArrowLeft className="h-4 w-4" />
      {role ? "Back to " + role + " dashboard" : "Sign in to TNP"}
    </a>
  );
}
