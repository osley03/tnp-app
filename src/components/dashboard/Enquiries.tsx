import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { RoleSidebar } from "./RoleSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
type Enquiry = {
  id: string;
  tenant_id: string;
  landlord_id: string;
  subject: string;
  message: string;
  landlord_reply: string | null;
  status: string;
  created_at: string;
};
export function Enquiries({ role }: { role: "tenant" | "landlord" }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ["enquiries", user?.id, role],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landlord_contact_requests" as never)
        .select("*")
        .eq(role === "tenant" ? "tenant_id" : "landlord_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Enquiry[];
    },
  });
  const reply = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc(
        "tnp_reply_to_enquiry" as never,
        { p_id: id, p_reply: drafts[id] ?? "" } as never,
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["enquiries"] });
    },
  });
  const content = (
    <div className="tnp-module tnp-module-light min-h-screen text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 px-6 py-6">
        <div className="flex items-center gap-3">
          {role === "landlord" && <SidebarTrigger />}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              TNP · {role} workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold">Property enquiries</h1>
            <p className="mt-2 text-sm text-slate-600">
              {role === "tenant"
                ? "Track enquiries sent from the landlord directory and read replies."
                : "Read tenant enquiries and respond from one place."}
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-5 px-6 py-8">
        {query.isLoading && <p role="status">Loading enquiries…</p>}
        {query.error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p>{query.error.message}</p>
            <button className="mt-3 underline" onClick={() => void query.refetch()}>
              Retry
            </button>
          </div>
        )}
        {!query.isLoading && !query.error && !query.data?.length && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
            No enquiries yet.{" "}
            {role === "tenant"
              ? "Send an enquiry from the Landlords directory."
              : "New tenant enquiries will appear here."}
          </div>
        )}
        {reply.error && (
          <p role="alert" className="text-red-700">
            {reply.error.message}
          </p>
        )}
        {query.data?.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{item.subject}</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {item.status}
              </span>
            </div>
            <time className="mt-1 block text-xs text-slate-500">
              {new Date(item.created_at).toLocaleString()}
            </time>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-7">{item.message}</p>
            {item.landlord_reply && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-semibold">Landlord reply</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{item.landlord_reply}</p>
              </div>
            )}
            {role === "landlord" && (
              <form
                className="mt-5 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  reply.mutate(item.id);
                }}
              >
                <label className="block text-sm font-semibold" htmlFor={"reply-" + item.id}>
                  Your reply
                </label>
                <textarea
                  id={"reply-" + item.id}
                  value={drafts[item.id] ?? ""}
                  onChange={(e) => setDrafts({ ...drafts, [item.id]: e.target.value })}
                  maxLength={10000}
                  rows={3}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900"
                />
                <button
                  disabled={reply.isPending || !drafts[item.id]?.trim()}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {reply.isPending ? "Sending…" : "Save reply"}
                </button>
              </form>
            )}
          </article>
        ))}
      </main>
    </div>
  );
  return role === "landlord" ? (
    <SidebarProvider>
      <RoleSidebar role="landlord" />
      <SidebarInset>{content}</SidebarInset>
    </SidebarProvider>
  ) : (
    content
  );
}
