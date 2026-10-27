import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
type Archived = {
  account_id: string;
  account_role: string;
  legal_name: string;
  deleted_at: string;
  auth_cleanup_pending: boolean;
};
export function DeletedAccounts() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const query = useQuery({
    queryKey: ["deleted-accounts"],
    queryFn: async () => {
      const result = await supabase
        .from("tnp_deleted_accounts" as never)
        .select("*")
        .order("deleted_at", { ascending: false })
        .limit(100);
      if (result.error) throw result.error;
      return result.data as unknown as Archived[];
    },
  });
  async function retry(accountId: string) {
    setBusy(accountId);
    setError("");
    try {
      const result = await supabase.functions.invoke("account-deletion", {
        body: { accountId, confirmation: "DELETE" },
      });
      if (result.error || result.data?.authCleanupPending)
        throw Error("Auth cleanup is still pending. Please retry or check the service logs.");
      await query.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cleanup failed");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="rounded-xl border bg-white p-4 text-slate-900">
      <h2 className="font-semibold">Deleted account archive</h2>
      <p className="text-sm">
        Most recent 100 closures. Evidence remains in the lease, payments and dispute modules,
        linked by account ID.
      </p>
      <button className="my-2 underline" onClick={() => query.refetch()}>
        Refresh archive
      </button>
      {query.isLoading && <p>Loading…</p>}
      {(query.error || error) && (
        <p role="alert" className="text-red-700">
          {error || "Unable to load archive"}
        </p>
      )}
      {query.data?.length === 0 && <p>No deleted accounts.</p>}
      <ul>
        {query.data?.map((a) => (
          <li key={a.account_id} className="border-t py-3">
            <strong>{a.legal_name || "Deleted account"}</strong> · {a.account_role}
            <p className="break-all text-xs">
              {a.account_id} · {new Date(a.deleted_at).toLocaleString()}
            </p>
            {a.auth_cleanup_pending ? (
              <button
                className="text-red-700 underline"
                disabled={!!busy}
                onClick={() => retry(a.account_id)}
              >
                {busy === a.account_id ? "Retrying…" : "Retry login cleanup"}
              </button>
            ) : (
              <p className="text-xs">Login disabled</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
