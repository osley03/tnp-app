import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/session";

const tone: Record<AppRole, string> = {
  tenant: "text-terra ring-terra/30 bg-terra/15",
  landlord: "text-ochre ring-ochre/30 bg-ochre/15",
  admin: "text-clay ring-clay/30 bg-clay/15",
};

export function AppBar({
  role,
  who,
  back,
}: {
  role: AppRole;
  who: string;
  back?: { to: string; label: string };
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out failed:", error);
      return;
    }

    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-10 -mx-3 mb-3 border-b border-line bg-ink/90 px-3 py-2.5 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[9px] tracking-wider text-mut">TNP · MUTUAL TRUST LEDGER</p>
          <h1 className="truncate font-display text-[13px] font-semibold tracking-tight">{who}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`rounded-md px-2 py-1 font-mono text-[9px] ring-1 ${tone[role]}`}>
            {role.toUpperCase()}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-md bg-panel-2 px-2 py-1 font-mono text-[9px] text-mut ring-1 ring-line"
          >
            Sign out
          </button>
        </div>
      </div>
      {back && (
        <Link
          to={back.to}
          className="mt-2 inline-flex items-center gap-1 font-mono text-[9px] text-mut hover:text-fg"
        >
          ← {back.label}
        </Link>
      )}
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <main className="tnp-module tnp-module-dark min-h-screen bg-ink text-[13px] leading-relaxed text-fg">
      <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6">{children}</div>
    </main>
  );
}

export function Card({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-panel p-5 shadow-lg shadow-black/5 ring-1 ring-line">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[12px] font-semibold tracking-tight">{title}</span>
        {meta && <span className="font-mono text-[9px] text-mut">{meta}</span>}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

export function Stat({ k, v, tone: t = "" }: { k: string; v: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-panel-2 px-2.5 py-2 ring-1 ring-line">
      <p className="font-mono text-[9px] text-mut">{k}</p>
      <p className={`mt-0.5 font-display text-[12px] font-semibold ${t}`}>{v}</p>
    </div>
  );
}

export function TrustMeter({ score, label }: { score: number; label: string }) {
  const grad =
    score >= 85 ? "from-terra to-ochre" : score >= 70 ? "from-ochre to-ochre" : "from-clay to-clay";
  return (
    <div>
      <div className="flex items-end justify-between">
        <p className="font-display text-4xl leading-none font-bold tracking-tight">
          {score}
          <span className="text-xl text-mut">/100</span>
        </p>
        <span className="font-mono text-[9px] text-mut">{label}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2 ring-1 ring-line">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${grad}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-lg bg-panel-2 px-2.5 py-3 text-[11px] text-mut ring-1 ring-line">
      {text}
    </p>
  );
}
