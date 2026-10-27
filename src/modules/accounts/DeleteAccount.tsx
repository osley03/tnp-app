import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export function DeleteAccount({ role }: { role: "tenant" | "landlord" | "admin" }) {
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const cache = useQueryClient();
  if (role === "admin") return null;
  async function remove() {
    setBusy(true);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) throw Error("Please sign in again.");
      const result = await supabase.functions.invoke("account-deletion", {
        body: { confirmation, password },
      });
      if (result.error) {
        let message = "Unable to delete your account. Please retry or contact support.";
        try {
          const response = (result.error as { context?: Response }).context;
          const details = await response?.json();
          if (typeof details?.error === "string") message = details.error;
        } catch {}
        throw Error(message);
      }
      if (!result.data?.closed)
        throw Error(
          result.data?.error || "Unable to delete your account. Please retry or contact support.",
        );
      await cache.cancelQueries();
      await supabase.auth.signOut({ scope: "local" });
      cache.clear();
      window.location.assign("/auth?account=deleted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete account");
      setBusy(false);
    }
  }
  return (
    <section id="delete-account" className="rounded-xl border border-red-200 bg-white p-4 text-slate-900">
      <h2 className="font-semibold">Delete account</h2>
      <p className="my-2 text-sm">
        Your account access will end and your profile will be removed from active use. Listings and
        tours will be unpublished. Essential identity, lease, application, payment and dispute
        records remain for administration and evidence. Deletion does not cancel rent or other
        obligations.
      </p>
      {!open ? (
        <button
          className="rounded-lg bg-red-700 px-4 py-2 text-white"
          onClick={() => setOpen(true)}
        >
          Delete my account
        </button>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm">
            Confirm your password
            <input
              type="password"
              autoComplete="current-password"
              className="block w-full rounded border bg-white p-2 text-slate-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="block text-sm">
            Type DELETE to confirm
            <input
              className="block w-full rounded border bg-white p-2 text-slate-900"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={busy}
            />
          </label>
          <button
            className="rounded-lg bg-red-700 px-4 py-2 text-white disabled:opacity-50"
            disabled={busy || confirmation !== "DELETE" || !password}
            onClick={remove}
          >
            {busy ? "Deleting account…" : "Permanently close my account"}
          </button>
          <button
            className="ml-3 text-slate-700"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              setPassword("");
              setConfirmation("");
              setError("");
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
